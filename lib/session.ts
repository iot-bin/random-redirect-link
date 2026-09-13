import 'server-only';
import { cookies } from 'next/headers';
import { bootstrap, isConfigured } from './bootstrap';
export const ACCESS_COOKIE = 'console-access';
export const REFRESH_COOKIE = 'console-refresh';
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };
export class AuthError extends Error {
  constructor(public code: string, public status = 401) { super(code); }
}
export async function cognito(operation: string, body: Record<string, unknown>) {
  if (!isConfigured()) throw new AuthError('CONFIG_ERROR', 503);
  const response = await fetch('https://cognito-idp.' + bootstrap.region + '.amazonaws.com/', {
    method: 'POST', headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.' + operation },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) {
    const name = String(result.__type ?? '').split('#').pop();
    const codes: Record<string,string> = { TooManyRequestsException:'AUTH_THROTTLED', LimitExceededException:'AUTH_THROTTLED', CodeMismatchException:'INVALID_CODE', ExpiredCodeException:'INVALID_CODE', InvalidPasswordException:'PASSWORD_POLICY', PasswordResetRequiredException:'RESET_REQUIRED' };
    throw new AuthError(codes[name ?? ''] ?? 'INVALID_PASSWORD', name === 'TooManyRequestsException' ? 429 : 400);
  }
  return result;
}
export async function saveTokens(result: {AccessToken?: string; RefreshToken?: string}) {
  if (!result.AccessToken) throw new AuthError('SESSION_EXPIRED');
  const jar = await cookies();
  // AWS validates expiration. Keep the cookie to support refresh after inactivity.
  jar.set(ACCESS_COOKIE, result.AccessToken, {...cookieOptions, maxAge: 7 * 86400});
  if (result.RefreshToken) jar.set(REFRESH_COOKIE, result.RefreshToken, {...cookieOptions, maxAge: 7 * 86400});
  jar.delete('session');
}
export async function clearSession() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE,REFRESH_COOKIE,'session','console-challenge','console-mfa-setup']) jar.delete(name);
}
export async function accessToken(refresh = false): Promise<string> {
  const jar = await cookies();
  if (!refresh && jar.get(ACCESS_COOKIE)?.value) return jar.get(ACCESS_COOKIE)!.value;
  const token = jar.get(REFRESH_COOKIE)?.value;
  if (!token) throw new AuthError('SESSION_EXPIRED');
  try {
    const result = await cognito('InitiateAuth', {ClientId:bootstrap.cognitoClientId,AuthFlow:'REFRESH_TOKEN_AUTH',AuthParameters:{REFRESH_TOKEN:token}});
    await saveTokens(result.AuthenticationResult ?? {});
    return result.AuthenticationResult.AccessToken;
  } catch (error) {
    if (error instanceof AuthError && error.code === 'INVALID_PASSWORD') {
      await clearSession(); throw new AuthError('SESSION_EXPIRED');
    }
    throw error;
  }
}

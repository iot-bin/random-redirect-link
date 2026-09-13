import { cookies } from 'next/headers';
import { accessToken, cognito, cookieOptions, AuthError } from '@/lib/session';
import { managementFetch, managementError } from '@/lib/management-api';
async function authorizedToken() {
  const check = await managementFetch('/me');
  await check.body?.cancel();
  if (!check.ok) throw new AuthError(check.status === 401 ? 'SESSION_EXPIRED' : 'ACCESS_DENIED', check.status);
  return accessToken();
}
export async function GET() {
  try {
    const user = await cognito('GetUser', { AccessToken: await authorizedToken() });
    return Response.json({ enabled: user.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') === true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return managementError(error); }
}
export async function POST(request: Request) {
  try {
    const token = await authorizedToken();
    const body = await request.json();
    const jar = await cookies();
    if (body.action === 'setup') {
      const user = await cognito('GetUser', { AccessToken: token });
      if (user.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA')) {
        return Response.json({ enabled: true }, { headers: { 'Cache-Control': 'no-store' } });
      }
      const result = await cognito('AssociateSoftwareToken', { AccessToken: token });
      jar.set('console-mfa-setup', 'pending', { ...cookieOptions, maxAge: 180 });
      return Response.json({ secret: result.SecretCode }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.action !== 'verify' || !jar.get('console-mfa-setup')?.value) throw new AuthError('INVALID_REQUEST', 400);
    const result = await cognito('VerifySoftwareToken', { AccessToken: token, UserCode: String(body.code ?? '') });
    if (result.Status !== 'SUCCESS') throw new AuthError('INVALID_CODE', 400);
    await cognito('SetUserMFAPreference', { AccessToken: token, SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } });
    jar.delete('console-mfa-setup');
    return Response.json({ success: true, enabled: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return managementError(error); }
}

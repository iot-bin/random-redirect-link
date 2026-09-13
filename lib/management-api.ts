import 'server-only';
import { NextResponse } from 'next/server';
import { bootstrap, isConfigured } from './bootstrap';
import { accessToken, AuthError } from './session';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from './session';
export async function managementFetch(path: string, method = 'GET', body?: unknown, refresh = true) {
  if (!isConfigured()) throw new AuthError('CONFIG_ERROR',503);
  const send = (token: string) => fetch(bootstrap.managementApiUrl.replace(/\/+$/, '') + path, {
    method, headers: {Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:body === undefined ? undefined : JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000),
  });
  const token = refresh ? await accessToken() : (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) throw new AuthError('SESSION_EXPIRED');
  let response = await send(token);
  if (response.status === 401 && refresh) {
    await response.body?.cancel();
    response = await send(await accessToken(true));
  }
  return response;
}
export function managementError(error: unknown) {
  const status = error instanceof AuthError ? error.status : 502;
  const code = error instanceof AuthError ? error.code : 'UPSTREAM_UNAVAILABLE';
  return NextResponse.json({error:code,code},{status,headers:{'Cache-Control':'no-store'}});
}
export async function forwardManagement(path: string, method = 'GET', body?: unknown) {
  try {
    const r = await managementFetch(path,method,body);
    return NextResponse.json(await r.json(), {status:r.status,headers:{'Cache-Control':'no-store'}});
  } catch(error) { return managementError(error); }
}

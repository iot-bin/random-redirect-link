import { cookies } from 'next/headers';
import { bootstrap } from '@/lib/bootstrap';
import { clearSession,cognito,REFRESH_COOKIE,AuthError } from '@/lib/session';
import { managementFetch,managementError } from '@/lib/management-api';
export async function POST() {
  try {
    const token=(await cookies()).get(REFRESH_COOKIE)?.value;
    const r=await managementFetch('/session/revoke','POST');
    await r.body?.cancel();
    if(!r.ok && r.status!==401 && r.status!==403) throw new Error('Revocation unavailable');
    if(token) await cognito('RevokeToken',{ClientId:bootstrap.cognitoClientId,Token:token});
    await clearSession();
    return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    if(error instanceof AuthError && ['SESSION_EXPIRED','INVALID_PASSWORD'].includes(error.code)) {
      await clearSession();return Response.json({success:true});
    }
    return managementError(error);
  }
}

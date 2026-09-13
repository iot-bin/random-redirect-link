import { bootstrap } from '@/lib/bootstrap';
import { cognito,AuthError } from '@/lib/session';
import { managementError } from '@/lib/management-api';
export async function POST(request:Request) {
  try {
    const b=await request.json();
    if(typeof b.username!=='string'||!b.username.trim()||b.username.length>128) throw new AuthError('INVALID_REQUEST',400);
    const confirm=b.action==='confirm';
    if(!confirm && b.action!=='request') throw new AuthError('INVALID_REQUEST',400);
    await cognito(confirm?'ConfirmForgotPassword':'ForgotPassword',{ClientId:bootstrap.cognitoClientId,Username:b.username.trim(),...(confirm?{ConfirmationCode:String(b.code??''),Password:String(b.password??'')}:{})});
    return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return managementError(error);}
}

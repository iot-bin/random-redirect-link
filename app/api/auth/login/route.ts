import { cookies } from 'next/headers';
import { bootstrap } from '@/lib/bootstrap';
import { cognito,cookieOptions,saveTokens,AuthError } from '@/lib/session';
import { managementError } from '@/lib/management-api';
export async function POST(request:Request) {
  try {
    const body=await request.json();
    const username=typeof body.username==='string'?body.username.trim():'';
    if(!username || username.length>128) throw new AuthError('INVALID_REQUEST',400);
    const jar=await cookies();
    let result;
    if(body.challenge) {
      const c=JSON.parse(jar.get('console-challenge')?.value??'{}');
      if(!c.session || c.username!==username || c.name!==body.challenge) throw new AuthError('SESSION_EXPIRED');
      const fields:Record<string,string>={USERNAME:c.cognitoUsername??username};
      if(c.name==='NEW_PASSWORD_REQUIRED') fields.NEW_PASSWORD=String(body.password??'');
      else if(c.name==='SOFTWARE_TOKEN_MFA') fields.SOFTWARE_TOKEN_MFA_CODE=String(body.code??'');
      else throw new AuthError('AUTH_CHALLENGE_UNSUPPORTED',400);
      result=await cognito('RespondToAuthChallenge',{ClientId:bootstrap.cognitoClientId,ChallengeName:c.name,Session:c.session,ChallengeResponses:fields});
    } else {
      jar.delete('console-challenge');
      if(typeof body.password!=='string'||!body.password||body.password.length>256) throw new AuthError('INVALID_REQUEST',400);
      result=await cognito('InitiateAuth',{ClientId:bootstrap.cognitoClientId,AuthFlow:'USER_PASSWORD_AUTH',AuthParameters:{USERNAME:username,PASSWORD:body.password}});
    }
    if(result.ChallengeName) {
      if(!['NEW_PASSWORD_REQUIRED','SOFTWARE_TOKEN_MFA'].includes(result.ChallengeName)) throw new AuthError('AUTH_CHALLENGE_UNSUPPORTED',400);
      jar.set('console-challenge',JSON.stringify({name:result.ChallengeName,session:result.Session,username,cognitoUsername:result.ChallengeParameters?.USER_ID_FOR_SRP}),{...cookieOptions,maxAge:180});
      return Response.json({challenge:result.ChallengeName},{headers:{'Cache-Control':'no-store'}});
    }
    await saveTokens(result.AuthenticationResult??{});
    jar.delete('console-challenge');
    return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return managementError(error);}
}

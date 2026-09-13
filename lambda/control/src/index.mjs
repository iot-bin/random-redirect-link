import './runtime.mjs';
import { randomUUID } from 'node:crypto';
import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminCreateUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { repository } from './repository.mjs';
import { callUpstream } from './upstream.mjs';
import { HttpError, fail, json, parseBody, isAdmin, allowed, validateConfig, validateMember } from './domain.mjs';
const cognito = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const identity = {
  async exists(sub) {
    try { const u = await cognito.send(new AdminGetUserCommand({ UserPoolId: process.env.USER_POOL_ID, Username: sub })); return u.Enabled; }
    catch (e) { if (e.name === 'UserNotFoundException') return false; throw e; }
  },
  async invite(email) {
    const u = await cognito.send(new AdminCreateUserCommand({ UserPoolId: process.env.USER_POOL_ID, Username: email, DesiredDeliveryMediums: ['EMAIL'], UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }] }));
    return u.User.Attributes.find(a => a.Name === 'sub').Value;
  },
};
export function createHandler({ db = repository, upstream = callUpstream, users = identity,
  apiIds = (process.env.BACKEND_API_IDS ?? '').split(','), clientId = process.env.CLIENT_ID,
  issuer = 'https://cognito-idp.' + process.env.AWS_REGION + '.amazonaws.com/' + process.env.USER_POOL_ID,
  now = Date.now, logger = console } = {}) {
  return async (event) => {
    const method = event.requestContext?.http?.method;
    const path = event.rawPath;
    let audit;
    const record = async (phase, extra = {}) => db.audit({ ...audit, phase, ...extra, at: new Date(now()).toISOString() });
    try {
      if (method === 'GET' && path === '/public/site') {
        const config = await db.get('CONFIG');
        return json(200, { title: config?.site?.title ?? '', description: config?.site?.description ?? '' });
      }
      // Claims originate exclusively from API Gateway's JWT authorizer, never request headers/body.
      const claims = event.requestContext?.authorizer?.jwt?.claims;
      if (!claims?.sub || claims.token_use !== 'access' || claims.client_id !== clientId || claims.iss !== issuer
        || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now() / 1000 || !claims.origin_jti) fail(401, 'SESSION_EXPIRED');
      if (await db.get('SESSION#' + claims.origin_jti)) fail(401, 'SESSION_EXPIRED');
      if (path === '/session/revoke' && method === 'POST') {
        await db.put('SESSION#' + claims.origin_jti, { purgeAt: Math.ceil(now() / 1000) + 8 * 86400 });
        return json(200, { success: true });
      }
      const member = await db.get('MEMBER#' + claims.sub);
      if (!member?.active || !await users.exists(claims.sub)) fail(403, 'ACCESS_DENIED');
      const config = await db.get('CONFIG');
      if (!config) fail(503, 'CONFIG_ERROR');
      if (method === 'GET' && path === '/me') {
        const targets = config.targets.filter(t => t.enabled && allowed(member, t.id)).map(t => ({ id: t.id, name: t.name, redirectBaseUrl: t.redirectBaseUrl, canWrite: allowed(member, t.id, true) }));
        const preferences = await db.get('PREF#' + claims.sub) ?? {};
        const candidate = preferences.targetId || config.defaultTargetId;
        return json(200, { targets, defaultTargetId: targets.some(t => t.id === candidate) ? candidate : targets[0]?.id ?? null,
          preferences, site: config.site, user: { sub: claims.sub, role: member.role } });
      }
      if (method === 'PUT' && path === '/preferences') {
        const b = parseBody(event);
        if (!config.targets.some(t => t.id === b.targetId && t.enabled && allowed(member,t.id)) || ![10,25,50].includes(b.pageSize)) fail(400,'INVALID_REQUEST');
        const preferences = { targetId: b.targetId, pageSize: b.pageSize };
        await db.put('PREF#' + claims.sub, preferences);
        return json(200, preferences);
      }
      if (['/config','/members','/audit'].includes(path)) {
        if (!isAdmin(member)) fail(403, 'ACCESS_DENIED');
        if (method === 'GET') {
          if (path === '/config') return json(200, { ...config, allowedApiIds: apiIds });
          if (path === '/members') return json(200, { members: await db.listMembers(), ownerSub: (await db.get('OWNER'))?.sub });
          return json(200, { entries: await db.listAudit() });
        }
        if (!((path === '/config' && method === 'PUT') || (path === '/members' && ['PUT','POST'].includes(method)))) fail(405,'METHOD_NOT_ALLOWED');
        const b = parseBody(event);
        audit = { id: randomUUID(), actor: claims.sub, operation: method + ' ' + path };
        if (path === '/config') {
          const next = validateConfig(b, apiIds);
          await record('attempt'); await db.put('CONFIG', next, b.version);
        } else if (method === 'POST') {
          if (typeof b.email !== 'string' || b.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) fail(400,'INVALID_MEMBER');
          await record('attempt');
          const sub = await users.invite(b.email);
          await db.put('MEMBER#' + sub, { sub, email:b.email, active:true, role:'member', grants:{}, version:1 }, 0);
        } else {
          const next = validateMember(b, config);
          if (next.sub === (await db.get('OWNER'))?.sub || next.sub === claims.sub) fail(409,'OWNER_PROTECTED');
          if (!await users.exists(next.sub)) fail(400,'INVALID_MEMBER');
          const current = await db.get('MEMBER#' + next.sub);
          await record('attempt'); await db.put('MEMBER#' + next.sub, {...next,email:current?.email}, b.version);
        }
        await record('result',{status:200}); return json(200,{success:true});
      }
      const match = /^\/targets\/([a-z0-9][a-z0-9_-]{0,63})(\/links(?:\/.*)?)$/.exec(path ?? '');
      if (!match) fail(404,'ROUTE_NOT_FOUND');
      const [, id, endpoint] = match;
      try {
        if (endpoint.split('/').some(segment => ['.', '..'].includes(decodeURIComponent(segment)) || /[\\/]/.test(decodeURIComponent(segment)))) fail(400,'INVALID_PATH');
      } catch (e) { if (e instanceof HttpError) throw e; fail(400,'INVALID_PATH'); }
      const valid = endpoint === '/links' ? ['GET','POST'].includes(method)
        : endpoint === '/links/batch' && method === 'POST' ? true : ['GET','PATCH','DELETE'].includes(method);
      if (!valid) fail(405,'METHOD_NOT_ALLOWED');
      const write = method !== 'GET';
      if (!allowed(member,id,write)) fail(403,'ACCESS_DENIED');
      const target = config.targets.find(t => t.id === id && t.enabled);
      if (!target || !apiIds.includes(target.apiId)) fail(404,'TARGET_NOT_FOUND');
      const body = ['POST','PATCH'].includes(method) ? parseBody(event) : undefined;
      const query = {};
      for (const key of ['limit','prefix','cursor','view']) if (event.queryStringParameters?.[key] !== undefined) query[key] = event.queryStringParameters[key];
      if (write) { audit = { id: randomUUID(), actor: claims.sub, targetId:id, operation:method, path:endpoint,
        ...(Array.isArray(body?.paths) ? { paths:body.paths.slice(0,50), action:body.action } : {}) }; await record('attempt'); }
      const response = await upstream(target,endpoint,method,query,body);
      if (write) await record('result',{status:response.statusCode});
      return json(response.statusCode,response.payload);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      if (audit) { try { await record('error',{status}); } catch { /* The durable attempt remains for reconciliation. */ } }
      if (!(error instanceof HttpError)) logger.error(JSON.stringify({requestId:event.requestContext?.requestId,errorName:error.name}));
      return json(status,{code:error instanceof HttpError ? error.code : 'CONTROL_UNAVAILABLE',error:error instanceof HttpError ? error.code : 'Management service unavailable'});
    }
  };
}
export const handler = createHandler();

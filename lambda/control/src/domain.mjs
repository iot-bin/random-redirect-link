export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export const fail = (status, code) => { throw new HttpError(status, code); };
export const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
export function parseBody(event) {
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body ?? '{}';
    if (Buffer.byteLength(raw) > 65536) fail(413, 'BODY_TOO_LARGE');
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_JSON');
    return body;
  } catch (error) { if (error instanceof HttpError) throw error; fail(400, 'INVALID_JSON'); }
}
export const isAdmin = member => member?.active === true && member.role === 'admin';
export function allowed(member, targetId, write = false) {
  if (!member?.active) return false;
  if (isAdmin(member)) return true;
  const grant = member.grants?.[targetId];
  return write ? grant === 'editor' : ['viewer', 'editor'].includes(grant);
}
export function validateConfig(input, apiIds) {
  if (!Number.isInteger(input.version) || input.version < 0 || !Array.isArray(input.targets) || input.targets.length > 50) fail(400, 'INVALID_CONFIG');
  const seen = new Set();
  const targets = input.targets.map(t => {
    if (!t || typeof t.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(t.id) || seen.has(t.id)
      || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 100
      || typeof t.apiId !== 'string' || !apiIds.includes(t.apiId) || typeof t.stage !== 'string' || !/^(\$default|[a-zA-Z0-9_-]{1,128})$/.test(t.stage)
      || typeof t.enabled !== 'boolean') fail(400, 'INVALID_CONFIG');
    let u;
    try { u = new URL(t.redirectBaseUrl); } catch { fail(400, 'INVALID_CONFIG'); }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) fail(400, 'INVALID_CONFIG');
    seen.add(t.id);
    return { id: t.id, name: t.name.trim(), apiId: t.apiId, stage: t.stage, enabled: t.enabled, redirectBaseUrl: u.toString().replace(/\/+$/, '') };
  });
  const site = {};
  for (const key of ['title', 'description']) {
    if (typeof input.site?.[key] !== 'string' || input.site[key].length > (key === 'title' ? 100 : 500)) fail(400, 'INVALID_CONFIG');
    site[key] = input.site[key].trim();
  }
  const defaultTargetId = input.defaultTargetId ?? '';
  if (typeof defaultTargetId !== 'string') fail(400, 'INVALID_CONFIG');
  if (defaultTargetId && !targets.some(t => t.id === defaultTargetId && t.enabled)) fail(400, 'INVALID_CONFIG');
  return { targets, site, defaultTargetId, version: input.version + 1 };
}
export function validateMember(input, config) {
  if (typeof input.sub !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.sub)
    || typeof input.active !== 'boolean' || !['admin', 'member'].includes(input.role)
    || !Number.isInteger(input.version) || input.version < 0) fail(400, 'INVALID_MEMBER');
  const grants = {};
  if (!input.grants || typeof input.grants !== 'object' || Array.isArray(input.grants)) fail(400, 'INVALID_MEMBER');
  for (const [id, role] of Object.entries(input.grants)) {
    if (!config.targets.some(t => t.id === id) || !['viewer', 'editor'].includes(role)) fail(400, 'INVALID_MEMBER');
    grants[id] = role;
  }
  return { sub: input.sub, active: input.active, role: input.role, grants, version: input.version + 1 };
}

// Pure link protocol rules. Keep this file independent of Node, Next and AWS.
export const MAX_LINK_PATH_LENGTH = 128;
export const MAX_TARGET_URL_LENGTH = 4096;
export const DEFAULT_LIST_LIMIT = 25;
export const MAX_LIST_LIMIT = 100;
export const MAX_BATCH_SIZE = 50;
export const MAX_CURSOR_LENGTH = 2048;
export const LINK_BATCH_ACTIONS = Object.freeze(['enable', 'disable', 'delete', 'restore']);
export const LINK_STATUS_CODES = Object.freeze([301, 302]);
export const LINK_MATCHES = Object.freeze(['contains', 'prefix', 'exact']);
export const LINK_STATES = Object.freeze(['all', 'active', 'disabled', 'scheduled', 'expired', 'purged', 'deleted']);
export const LINK_SORTS = Object.freeze(['path-asc', 'path-desc']);
export const LINK_VIEWS = Object.freeze(['links', 'trash']);
export const LINK_QUERY_KEYS = Object.freeze(['limit', 'prefix', 'cursor', 'view', 'q', 'match', 'state', 'sort']);

export const isLinkBatchAction = (value) => LINK_BATCH_ACTIONS.includes(value);
export const isLinkStatusCode = (value) => LINK_STATUS_CODES.includes(value);
export const isLinkMatch = (value) => LINK_MATCHES.includes(value);
export const isLinkState = (value) => LINK_STATES.includes(value);
export const isLinkSort = (value) => LINK_SORTS.includes(value);
export const isLinkView = (value) => LINK_VIEWS.includes(value);

export function normalizeLinkPath(input) {
  const path = String(input ?? '').trim();
  let start = 0;
  let end = path.length;
  while (path[start] === '/') start++;
  while (end > start && path[end - 1] === '/') end--;
  return path.slice(start, end);
}

export function normalizeLinkPrefix(input) {
  const prefix = String(input ?? '').trim();
  let start = 0;
  while (prefix[start] === '/') start++;
  return prefix.slice(start);
}

// Return a stable reason; callers map it to their own localized message/error.
export function linkPathIssue(input, { prefix = false } = {}) {
  const path = prefix ? normalizeLinkPrefix(input) : normalizeLinkPath(input);
  if (!path && !prefix) return 'required';
  if (path.length > MAX_LINK_PATH_LENGTH) return 'length';
  if (path.includes('..')) return 'dot_segments';
  if (path.includes('//')) return 'double_slash';
  if (path.includes('?') || path.includes('#')) return 'query_fragment';
  return null;
}

export function targetUrlIssue(value) {
  if (typeof value !== 'string') return 'type';
  const trimmed = value.trim();
  if (!trimmed) return 'required';
  if (trimmed.length > MAX_TARGET_URL_LENGTH) return 'length';
  let url;
  try { url = new URL(trimmed); } catch { return 'invalid'; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'protocol';
  if (url.username || url.password) return 'credentials';
  if (url.search || url.hash) return 'query_fragment';
  return null;
}

export function splitTargetUrl(value) {
  const target = new URL(value.trim());
  return {
    targetUrl: target.toString(),
    targetBaseUrl: `${target.protocol}//${target.host}`,
    targetPath: target.pathname || '/'
  };
}

export function isSubdomainLength(value) {
  return Number.isInteger(value) && value >= 3 && value <= 32;
}

export function isLinkRecord(value) {
  return typeof value === 'object' && value !== null && typeof value.path === 'string' && value.path !== '';
}

export function linkListResponse(items, nextCursor) {
  return { items, nextCursor };
}

export function linkBatchResponse(action, succeeded, failed) {
  return { action, succeeded, failed };
}

export function parseLinkListResponse(value) {
  if (typeof value !== 'object' || value === null) return null;
  if (!Array.isArray(value.items) || !value.items.every(isLinkRecord)) return null;
  if (value.nextCursor !== null && typeof value.nextCursor !== 'string') return null;
  return { items: value.items, nextCursor: value.nextCursor };
}

export function parseLinkBatchResponse(value) {
  if (typeof value !== 'object' || value === null || !isLinkBatchAction(value.action)) return null;
  if (!Array.isArray(value.succeeded) || !Array.isArray(value.failed)) return null;
  const succeeded = value.succeeded.map((entry) => {
    if (!entry || typeof entry.path !== 'string' || !entry.path || (entry.item !== undefined && !isLinkRecord(entry.item))) return null;
    return { path: entry.path, ...(entry.item !== undefined ? { item: entry.item } : {}) };
  });
  const failed = value.failed.map((entry) => {
    if (!entry || typeof entry.path !== 'string' || typeof entry.code !== 'string' || typeof entry.error !== 'string') return null;
    return { path: entry.path, code: entry.code, error: entry.error };
  });
  if (succeeded.includes(null) || failed.includes(null)) return null;
  return { action: value.action, succeeded, failed };
}

// Public redirect lookup intentionally has different normalization from link creation.
export function normalizePublicRequestPath(rawPath) {
  const trimmed = String(rawPath ?? '').trim();
  const withoutLeadingSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  let decoded = withoutLeadingSlash;
  try { decoded = decodeURIComponent(withoutLeadingSlash); } catch { /* safe lookup miss */ }
  let end = decoded.length;
  while (end > 0 && decoded[end - 1] === '/') end--;
  return decoded.slice(0, end);
}

export function requestPath(event) {
  const raw = event?.rawPath ?? event?.path ?? '/';
  const context = event?.requestContext;
  const stage = context?.stage;
  const directEndpoint = /^[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/.test(context?.domainName ?? '');
  if (event?.version === '2.0' && directEndpoint && stage && stage !== '$default') {
    const prefix = '/' + stage;
    if (raw === prefix) return '/';
    if (raw.startsWith(prefix + '/')) return raw.slice(prefix.length);
  }
  return raw;
}

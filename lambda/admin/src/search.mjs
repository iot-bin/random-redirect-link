import { HttpError } from './errors.mjs';
import { isLinkMatch, isLinkState, isLinkSort } from './link-contracts.mjs';

export function parseSearch(query) {
  const q = String(query.q ?? '').trim();
  const match = query.match ?? 'contains';
  const state = query.state ?? 'all';
  const sort = query.sort ?? 'path-asc';
  if (q.length > 512 || /[\u0000-\u001f\u007f]/.test(q)
    || !isLinkMatch(match)
    || !isLinkState(state)
    || !isLinkSort(sort)) {
    throw new HttpError(400, 'INVALID_SEARCH', 'Invalid search options');
  }
  return { q, match, state, sort };
}

export function recordState(item, now) {
  if (item.purgeAt != null && item.purgeAt * 1000 <= now) return 'purged';
  if (item.deletedAt) return 'deleted';
  if (item.expiresAt && Date.parse(item.expiresAt) <= now) return 'expired';
  if (item.enabled === false) return 'disabled';
  if (item.startsAt && Date.parse(item.startsAt) > now) return 'scheduled';
  return 'active';
}

export function matchesSearch(item, { q = '', match = 'contains', state = 'all' }, now) {
  if (state !== 'all' && recordState(item, now) !== state) return false;
  if (!q) return true;
  if (match === 'exact') return item.path === q;
  if (match === 'prefix') return item.path.startsWith(q);
  const target = item.targetUrl || `${item.targetBaseUrl ?? ''}${item.targetPath ?? ''}`;
  return [item.path, target].some(value => value.toLowerCase().includes(q.toLowerCase()));
}

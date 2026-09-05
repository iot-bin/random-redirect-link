import type { LinkRecord } from './link-types';
export function toLocalInput(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(Date.parse(value) + 8 * 3600_000).toISOString().slice(0, 19);
}
export function scheduleInput(startsAt: string, expiresAt: string) {
  const parse = (value: string) => {
    if (!value) return null;
    const time = Date.parse(value + '+08:00');
    if (!Number.isFinite(time)) throw new Error('Invalid date');
    return new Date(time).toISOString();
  };
  const start = parse(startsAt),
    end = parse(expiresAt);
  if (start && end && start >= end) throw new Error('Invalid range');
  return { startsAt: start, expiresAt: end };
}
export function linkState(item: LinkRecord, now: number) {
  if (item.purgeAt != null && item.purgeAt * 1000 <= now) return 'purged';
  if (item.deletedAt) return 'deleted';
  if (item.expiresAt && Date.parse(item.expiresAt) <= now) return 'expired';
  if (item.enabled === false) return 'disabled';
  if (item.startsAt && Date.parse(item.startsAt) > now) return 'scheduled';
  return 'active';
}

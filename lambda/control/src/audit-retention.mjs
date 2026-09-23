const DAY_SECONDS = 86400;

export function auditPurgeAt(at, retentionDays) {
  return Math.floor(Date.parse(at) / 1000) + retentionDays * DAY_SECONDS;
}

export function auditCutoff(now, retentionDays) {
  return new Date(now - retentionDays * DAY_SECONDS * 1000).toISOString();
}

import { HttpError } from "./errors.mjs";
export const RETENTION_SECONDS = 7 * 24 * 60 * 60;
export function scheduleFields(body) {
  const fields = {};
  for (const key of ["startsAt", "expiresAt"]) {
    if (!Object.hasOwn(body, key)) continue;
    const value = body[key];
    if (value === null) {
      fields[key] = null;
      continue;
    }
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
      ) ||
      !Number.isFinite(Date.parse(value))
    ) {
      throw new HttpError(
        400,
        "INVALID_SCHEDULE",
        "Use an ISO timestamp with a timezone"
      );
    }
    const calendarDate = new Date(value.slice(0, 10) + "T00:00:00Z");
    if (
      calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10) ||
      Number(value.slice(11, 13)) > 23
    ) {
      throw new HttpError(400, "INVALID_SCHEDULE", "Invalid calendar date");
    }
    fields[key] = new Date(value).toISOString();
  }
  return fields;
}
export function validateSchedule(item) {
  if (
    item.startsAt &&
    item.expiresAt &&
    Date.parse(item.startsAt) >= Date.parse(item.expiresAt)
  ) {
    throw new HttpError(
      400,
      "INVALID_SCHEDULE",
      "startsAt must be before expiresAt"
    );
  }
}
export function schedulePurgeAt(item) {
  return item.expiresAt
    ? Math.ceil(Date.parse(item.expiresAt) / 1000) + RETENTION_SECONDS
    : null;
}
export function lifecycleUpdate(current, fields, now = Date.now()) {
  const result = { ...fields };
  const restoring = result.restore === true;
  delete result.restore;
  if (current.purgeAt != null && current.purgeAt <= now / 1000) {
    throw new HttpError(409, "RETENTION_ENDED", "Retention period has ended");
  }
  if (current.deletedAt && !restoring) {
    throw new HttpError(
      409,
      "LINK_DELETED",
      "Restore this link before editing"
    );
  }
  if (restoring && !current.deletedAt) {
    throw new HttpError(
      409,
      "LINK_NOT_DELETED",
      "Link is not in the recycle bin"
    );
  }
  const merged = { ...current, ...result };
  validateSchedule(merged);
  if (restoring && merged.expiresAt && Date.parse(merged.expiresAt) <= now) {
    throw new HttpError(
      409,
      "RESTORE_EXPIRED",
      "Extend or clear the expiry before restoring"
    );
  }
  if (restoring) result.deletedAt = null;
  result.purgeAt = schedulePurgeAt(merged);
  return result;
}

import test from "node:test";
import assert from "node:assert/strict";
import {
  lifecycleUpdate,
  scheduleFields,
  schedulePurgeAt,
  RETENTION_SECONDS
} from "../src/lifecycle.mjs";
const now = Date.parse("2030-01-01T00:00:00Z");
const deleted = {
  deletedAt: "2029-12-31T00:00:00Z",
  purgeAt: now / 1000 + 100,
  enabled: false
};
test("requires timezone-qualified dates and accepts explicit clearing", () => {
  assert.throws(() => scheduleFields({ startsAt: "2030-01-01T08:00" }), {
    code: "INVALID_SCHEDULE"
  });
  assert.throws(() => scheduleFields({ startsAt: "2030-02-30T00:00:00Z" }), {
    code: "INVALID_SCHEDULE"
  });
  assert.throws(() => scheduleFields({ startsAt: 42 }), {
    code: "INVALID_SCHEDULE"
  });
  assert.equal(
    scheduleFields({ startsAt: "2030-01-01T08:00:00+08:00" }).startsAt,
    "2030-01-01T00:00:00.000Z"
  );
  assert.deepEqual(scheduleFields({ expiresAt: null }), { expiresAt: null });
});
test("validates a partial update against the existing start date", () => {
  assert.throws(
    () =>
      lifecycleUpdate(
        { startsAt: "2030-01-02T00:00:00Z" },
        { expiresAt: "2030-01-01T00:00:00Z" },
        now
      ),
    { code: "INVALID_SCHEDULE" }
  );
});
test("separates expiry from cleanup and removes TTL when expiry is cleared", () => {
  assert.equal(
    schedulePurgeAt({ expiresAt: "2030-01-01T00:00:00Z" }),
    now / 1000 + RETENTION_SECONDS
  );
  assert.equal(
    lifecycleUpdate(
      { expiresAt: "2030-01-02T00:00:00Z" },
      { expiresAt: null },
      now
    ).purgeAt,
    null
  );
});
test("restores without changing enabled state and clears deletion and TTL fields", () => {
  assert.deepEqual(lifecycleUpdate(deleted, { restore: true }, now), {
    deletedAt: null,
    purgeAt: null
  });
});
test("rejects editing trash and restoration at the retention deadline", () => {
  assert.throws(() => lifecycleUpdate(deleted, { enabled: true }, now), {
    code: "LINK_DELETED"
  });
  assert.throws(
    () =>
      lifecycleUpdate(
        { ...deleted, purgeAt: now / 1000 },
        { restore: true },
        now
      ),
    { code: "RETENTION_ENDED" }
  );
});
test("requires an expired restored link to be extended or cleared", () => {
  const item = { ...deleted, expiresAt: new Date(now).toISOString() };
  assert.throws(() => lifecycleUpdate(item, { restore: true }, now), {
    code: "RESTORE_EXPIRED"
  });
  assert.equal(
    lifecycleUpdate(item, { restore: true, expiresAt: null }, now).purgeAt,
    null
  );
});

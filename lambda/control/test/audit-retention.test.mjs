import assert from 'node:assert/strict';
import test from 'node:test';
import { auditCutoff, auditPurgeAt } from '../src/audit-retention.mjs';

test('audit expiry and visible cutoff use the same retention window', () => {
  const at = '2026-09-23T00:00:00.000Z';
  const now = Date.parse(at);
  assert.equal(auditPurgeAt(at, 30), Math.floor(now / 1000) + 30 * 86400);
  assert.equal(auditCutoff(now, 30), '2026-08-24T00:00:00.000Z');
});

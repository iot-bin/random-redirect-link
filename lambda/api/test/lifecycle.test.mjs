import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../src/index.mjs";
const now = Date.parse("2030-01-01T00:00:00Z");
const base = {
  path: "example",
  enabled: true,
  targetUrl: "https://example.com",
  randomSubdomain: false
};
for (const method of ["GET", "HEAD"]) {
  test(
    method +
      " enforces start-inclusive, expiry-exclusive boundaries and ignores TTL lag",
    async () => {
      for (const [fields, expected] of [
        [{}, 302],
        [{ startsAt: new Date(now + 1).toISOString() }, 404],
        [{ startsAt: new Date(now).toISOString() }, 302],
        [{ expiresAt: new Date(now + 1).toISOString() }, 302],
        [
          {
            expiresAt: new Date(now).toISOString(),
            purgeAt: now / 1000 + 604800
          },
          404
        ],
        [{ deletedAt: new Date(now).toISOString() }, 404],
        [{ startsAt: "invalid" }, 404]
      ]) {
        const handler = createHandler({
          getLink: async () => ({ ...base, ...fields }),
          isConfigured: () => true,
          now: () => now
        });
        const response = await handler({
          rawPath: "/example",
          requestContext: { http: { method } }
        });
        assert.equal(response.statusCode, expected);
        assert.match(response.headers["Cache-Control"], /no-store/);
        if (expected === 404)
          assert.equal(response.headers.Location, undefined);
      }
    }
  );
}

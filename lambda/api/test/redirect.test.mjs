import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRandomTargetUrl,
  parseStatusCode,
  parseSubdomainLength,
  resolveRedirect
} from "../src/redirect.mjs";

const zeroBytes = (length) => Buffer.alloc(length, 0);

test("resolves a fixed target without rewriting it", () => {
  assert.deepEqual(
    resolveRedirect({
      statusCode: 301,
      randomSubdomain: false,
      targetUrl: "https://example.com/download?q=1"
    }),
    {
      statusCode: 301,
      location: "https://example.com/download?q=1"
    }
  );
});

test("builds a deterministic random-subdomain target", () => {
  assert.equal(
    buildRandomTargetUrl(
      "https://example.com/?source=short-link",
      "downloads/app.apk",
      5,
      zeroBytes
    ),
    "https://aaaaa.example.com/downloads/app.apk?source=short-link"
  );
});

test("resolves a random-subdomain record", () => {
  assert.deepEqual(
    resolveRedirect({
      randomSubdomain: true,
      targetBaseUrl: "https://example.com",
      targetPath: "/file",
      subdomainLength: 3
    }, { randomBytes: zeroBytes }),
    {
      statusCode: 302,
      location: "https://aaa.example.com/file"
    }
  );
});

test("accepts only status codes supported by the Admin Lambda", () => {
  assert.equal(parseStatusCode(undefined), 302);
  assert.equal(parseStatusCode(301), 301);
  assert.throws(() => parseStatusCode(307), /invalid statusCode/);
});

test("validates subdomain length at the public boundary", () => {
  assert.equal(parseSubdomainLength(undefined), 10);
  assert.equal(parseSubdomainLength(3), 3);
  assert.throws(() => parseSubdomainLength(2), /invalid subdomainLength/);
  assert.throws(() => parseSubdomainLength(33), /invalid subdomainLength/);
});

test("rejects malformed target URLs", () => {
  assert.throws(
    () => resolveRedirect({ randomSubdomain: false, targetUrl: "javascript:alert(1)" }),
    /invalid targetUrl/
  );
});

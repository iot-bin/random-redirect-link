import assert from "node:assert/strict";
import test from "node:test";
import {
  getUpdateFields,
  parseBatchRequest,
  parseLimit,
  parseRandomSubdomain,
  parseTargetUrl
} from "../src/validation.mjs";

test("splits a valid target URL into base URL and path", () => {
  assert.deepEqual(parseTargetUrl("https://example.com/download/app.apk"), {
    targetUrl: "https://example.com/download/app.apk",
    targetBaseUrl: "https://example.com",
    targetPath: "/download/app.apk"
  });
});

test("rejects target URLs with query parameters", () => {
  assert.throws(
    () => parseTargetUrl("https://example.com/file?token=1"),
    (error) => error?.code === "INVALID_TARGET_URL"
  );
});

test("preserves false when parsing an enabled update", () => {
  assert.deepEqual(getUpdateFields({ enabled: false }), { enabled: false });
});

test("defaults random subdomains to enabled and accepts an explicit opt-out", () => {
  assert.equal(parseRandomSubdomain(undefined), true);
  assert.equal(parseRandomSubdomain(true), true);
  assert.equal(parseRandomSubdomain(false), false);
  assert.throws(
    () => parseRandomSubdomain("false"),
    (error) => error?.code === "INVALID_RANDOM_SUBDOMAIN"
  );
});

test("parses and deduplicates batch paths", () => {
  const result = parseBatchRequest({
    body: JSON.stringify({
      action: "disable",
      paths: ["a", "/a/", "nested/path"]
    })
  });

  assert.deepEqual(result, {
    action: "disable",
    paths: ["a", "nested/path"]
  });
});

test("validates list limits", () => {
  assert.equal(parseLimit(undefined), 25);
  assert.equal(parseLimit("100"), 100);
  assert.throws(
    () => parseLimit("101"),
    (error) => error?.code === "INVALID_LIMIT"
  );
});

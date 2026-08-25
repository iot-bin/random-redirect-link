import assert from "node:assert/strict";
import test from "node:test";
import { createLinkItem, toPublicItem } from "../src/link-record.mjs";

const target = {
  targetUrl: "https://example.com/download/app.apk",
  targetBaseUrl: "https://example.com",
  targetPath: "/download/app.apk"
};

test("stores the configured random subdomain mode", () => {
  const item = createLinkItem({
    path: "download/random",
    target,
    randomSubdomain: true,
    subdomainLength: 5
  });

  assert.equal(item.randomSubdomain, true);
  assert.equal(item.subdomainLength, 5);
});

test("creates a fixed target record without an irrelevant random length", () => {
  const item = createLinkItem({
    path: "download/fixed",
    target,
    randomSubdomain: false
  });

  assert.equal(item.randomSubdomain, false);
  assert.equal(item.targetUrl, target.targetUrl);
  assert.equal(Object.hasOwn(item, "subdomainLength"), false);
  assert.equal(toPublicItem(item).listPk, undefined);
});

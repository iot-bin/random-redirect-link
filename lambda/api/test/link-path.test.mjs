import assert from "node:assert/strict";
import test from "node:test";
import { normalizePath } from "../src/link-path.mjs";

test("normalizes leading and trailing slashes", () => {
  assert.equal(normalizePath(" /download/app/ "), "download/app");
});

test("decodes encoded paths", () => {
  assert.equal(normalizePath("/%E6%B5%8B%E8%AF%95"), "测试");
});

test("keeps malformed encodings for a safe lookup miss", () => {
  assert.equal(normalizePath("/%E0%A4%A"), "%E0%A4%A");
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  decodePathFromRawPath,
  getPathError,
  normalizePath
} from "../src/link-path.mjs";

test("normalizes leading and trailing slashes", () => {
  assert.equal(normalizePath(" /download/app/ "), "download/app");
});

test("decodes every path segment", () => {
  assert.equal(
    decodePathFromRawPath("/links/download/%E6%B5%8B%E8%AF%95"),
    "download/测试"
  );
});

test("rejects malformed encoded paths", () => {
  assert.throws(
    () => decodePathFromRawPath("/links/%E0%A4%A"),
    (error) => error?.code === "INVALID_PATH"
  );
});

test("rejects unsafe paths", () => {
  assert.equal(getPathError("a//b"), "path must not contain consecutive slashes");
  assert.equal(getPathError("../a"), "path must not contain ..");
  assert.equal(getPathError("a?b"), "path must not contain query or fragment characters");
});

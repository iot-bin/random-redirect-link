import assert from "node:assert/strict";
import test from "node:test";
import { decodeCursor, encodeCursor } from "../src/cursor.mjs";

test("round-trips a DynamoDB pagination key", () => {
  const key = { listPk: "LINK", path: "download/app" };
  const cursor = encodeCursor(key, "download");

  assert.deepEqual(decodeCursor(cursor, "download"), key);
});

test("binds a cursor to its prefix", () => {
  const cursor = encodeCursor({ listPk: "LINK", path: "a" }, "a");

  assert.throws(
    () => decodeCursor(cursor, "b"),
    (error) => error?.code === "INVALID_CURSOR"
  );
});

test("rejects malformed cursor values", () => {
  assert.throws(
    () => decodeCursor("not.valid", ""),
    (error) => error?.code === "INVALID_CURSOR"
  );
});

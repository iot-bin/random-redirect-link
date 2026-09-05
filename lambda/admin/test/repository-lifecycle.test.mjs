import test from "node:test";
import assert from "node:assert/strict";
process.env.TABLE_NAME = "test-table";
const { ddb } = await import("../src/dynamodb.mjs");
const { deleteLinkRecord, updateLinkRecord, listLinkRecords } =
  await import("../src/repository.mjs");
test("soft deletion preserves content, is idempotent, and uses a conditional update", async (t) => {
  const item = {
    path: "x",
    targetUrl: "https://example.com",
    updatedAt: "2030-01-01T00:00:00Z"
  };
  const writes = [];
  t.mock.method(ddb, "send", async (command) => {
    if (command.constructor.name === "GetCommand") {
      assert.equal(command.input.ConsistentRead, true);
      return { Item: item };
    }
    assert.equal(command.constructor.name, "UpdateCommand");
    writes.push(command.input);
    return {
      Attributes: {
        ...item,
        deletedAt: "2030-01-01T01:00:00Z",
        purgeAt: 9999999999
      }
    };
  });
  const result = await deleteLinkRecord("x");
  assert.equal(result.targetUrl, item.targetUrl);
  assert.match(writes[0].ConditionExpression, /#version = :version/);
  Object.assign(item, result);
  assert.deepEqual(await deleteLinkRecord("x"), result);
  assert.equal(writes.length, 1);
});
test("stale edits and concurrent mutation cannot overwrite a newer record", async (t) => {
  const item = { path: "x", updatedAt: "v2" };
  t.mock.method(ddb, "send", async (command) => {
    if (command.constructor.name === "GetCommand") return { Item: item };
    throw Object.assign(new Error("race"), {
      name: "ConditionalCheckFailedException"
    });
  });
  await assert.rejects(updateLinkRecord("x", { enabled: false }, "v1"), {
    code: "LINK_VERSION_CONFLICT"
  });
  await assert.rejects(updateLinkRecord("x", { enabled: false }, "v2"), {
    code: "LINK_VERSION_CONFLICT"
  });
});
test("restoring an item removed by TTL cannot recreate it", async (t) => {
  t.mock.method(ddb, "send", async () => ({}));
  await assert.rejects(updateLinkRecord("gone", { restore: true }), {
    code: "LINK_NOT_FOUND"
  });
});
test("filtered empty DynamoDB pages are traversed without losing the cursor", async (t) => {
  let calls = 0;
  t.mock.method(ddb, "send", async (command) => {
    assert.match(command.input.FilterExpression, /attribute_exists/);
    calls++;
    return calls === 1
      ? { Items: [], LastEvaluatedKey: { path: "a", listPk: "LINK" } }
      : { Items: [{ path: "b" }] };
  });
  const result = await listLinkRecords({ limit: 2, prefix: "", view: "trash" });
  assert.equal(calls, 2);
  assert.deepEqual(result.Items, [{ path: "b" }]);
});

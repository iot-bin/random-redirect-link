import assert from "node:assert/strict";
import test from "node:test";
import { batchMutateLinks } from "../src/handlers/batch.mjs";

function batchEvent(action, paths) {
  return { body: JSON.stringify({ action, paths }) };
}

function parseBody(response) {
  return JSON.parse(response.body);
}

test("keeps a missing link as an item-level batch failure", async () => {
  const notFound = new Error("missing link");
  notFound.name = "ConditionalCheckFailedException";

  const response = await batchMutateLinks(
    batchEvent("disable", ["missing"]),
    {
      updateLinkEnabled: async () => {
        throw notFound;
      }
    }
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(parseBody(response), {
    action: "disable",
    succeeded: [],
    failed: [{
      path: "missing",
      code: "LINK_NOT_FOUND",
      error: "not found"
    }]
  });
});

test("rethrows throttling so the top-level handler can return 503", async () => {
  const throttled = new Error("throttled");
  throttled.name = "ThrottlingException";

  await assert.rejects(
    batchMutateLinks(
      batchEvent("enable", ["example"]),
      {
        updateLinkEnabled: async () => {
          throw throttled;
        }
      }
    ),
    (error) => error === throttled
  );
});

test("rethrows systemic DynamoDB errors instead of returning HTTP 200", async () => {
  const accessDenied = new Error("access denied");
  accessDenied.name = "AccessDeniedException";

  await assert.rejects(
    batchMutateLinks(
      batchEvent("delete", ["example"]),
      {
        deleteLink: async () => {
          throw accessDenied;
        }
      }
    ),
    (error) => error === accessDenied
  );
});

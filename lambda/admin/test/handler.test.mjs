import assert from "node:assert/strict";
import test from "node:test";

process.env.TABLE_NAME = "test-table";
process.env.ADMIN_TOKEN = "test-token";

const { handler } = await import("../src/index.mjs");

function parseBody(response) {
  return JSON.parse(response.body);
}

test("rejects unauthorized requests before routing", async () => {
  const response = await handler({
    requestContext: { http: { method: "GET" } },
    rawPath: "/links"
  });

  assert.equal(response.statusCode, 401);
  assert.equal(parseBody(response).code, "UNAUTHORIZED");
});

test("returns a stable error for unknown routes", async () => {
  const response = await handler({
    headers: { authorization: "Bearer test-token" },
    requestContext: { http: { method: "GET" } },
    rawPath: "/unknown"
  });

  assert.equal(response.statusCode, 404);
  assert.equal(parseBody(response).code, "ROUTE_NOT_FOUND");
});

test("validates update payloads before calling DynamoDB", async () => {
  const response = await handler({
    headers: { authorization: "Bearer test-token" },
    requestContext: { http: { method: "PATCH" } },
    rawPath: "/links/example",
    body: JSON.stringify({ enabled: "false" })
  });

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response).code, "INVALID_ENABLED");
});

test("validates batch actions before calling DynamoDB", async () => {
  const response = await handler({
    headers: { authorization: "Bearer test-token" },
    requestContext: { http: { method: "POST" } },
    rawPath: "/links/batch",
    body: JSON.stringify({ action: "archive", paths: ["example"] })
  });

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response).code, "INVALID_BATCH_ACTION");
});

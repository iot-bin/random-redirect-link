import assert from "node:assert/strict";
import test from "node:test";

process.env.TABLE_NAME = "test-table";
process.env.MANAGEMENT_ROLE_ARN = "arn:aws:iam::123456789012:role/control";
const authorizer = { iam: { accountId: "123456789012", userArn: "arn:aws:sts::123456789012:assumed-role/control/session" } };

const { handler } = await import("../src/index.mjs");

function parseBody(response) {
  return JSON.parse(response.body);
}

test('rejects bearer-only, wrong-account and wrong-role requests', async () => {
  for (const iam of [undefined,
    { accountId: '123456789012', userArn: 'arn:aws:sts::123456789012:assumed-role/other/session' },
    { accountId: '999999999999', userArn: 'arn:aws:sts::123456789012:assumed-role/control/session' },
    { accountId: '123456789012', userArn: 'arn:aws:sts::123456789012:assumed-role/control-evil/session' }]) {
    const response = await handler({ headers: { authorization: 'Bearer test-token' }, rawPath: '/links', requestContext: { http: { method: 'GET' }, authorizer: { iam } } });
    assert.equal(response.statusCode, 401);
  }
});

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
    requestContext: { authorizer, http: { method: "GET" } },
    rawPath: "/unknown"
  });

  assert.equal(response.statusCode, 404);
  assert.equal(parseBody(response).code, "ROUTE_NOT_FOUND");
});

test("validates update payloads before calling DynamoDB", async () => {
  const response = await handler({
    headers: { authorization: "Bearer test-token" },
    requestContext: { authorizer, http: { method: "PATCH" } },
    rawPath: "/links/example",
    body: JSON.stringify({ enabled: "false" })
  });

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response).code, "INVALID_ENABLED");
});

test("validates batch actions before calling DynamoDB", async () => {
  const response = await handler({
    headers: { authorization: "Bearer test-token" },
    requestContext: { authorizer, http: { method: "POST" } },
    rawPath: "/links/batch",
    body: JSON.stringify({ action: "archive", paths: ["example"] })
  });

  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response).code, "INVALID_BATCH_ACTION");
});

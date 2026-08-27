import assert from "node:assert/strict";
import test from "node:test";
import { createHandler } from "../src/index.mjs";

const silentLogger = { error() {} };

function event(method = "GET", rawPath = "/hello") {
  return {
    requestContext: { http: { method } },
    rawPath
  };
}

test("fails closed when TABLE_NAME is unavailable", async () => {
  const handler = createHandler({
    isConfigured: () => false,
    logger: silentLogger
  });

  const response = await handler(event());
  assert.equal(response.statusCode, 500);
  assert.equal(response.body, "Server configuration is incomplete");
});

test("returns 404 for an empty path", async () => {
  const handler = createHandler({
    isConfigured: () => true,
    logger: silentLogger
  });

  const response = await handler(event("GET", "/"));
  assert.equal(response.statusCode, 404);
});

test("returns 404 for missing and disabled links", async () => {
  const missingHandler = createHandler({
    getLink: async () => undefined,
    isConfigured: () => true,
    logger: silentLogger
  });
  const disabledHandler = createHandler({
    getLink: async () => ({ enabled: false }),
    isConfigured: () => true,
    logger: silentLogger
  });

  assert.equal((await missingHandler(event())).statusCode, 404);
  assert.equal((await disabledHandler(event())).statusCode, 404);
});

test("returns a no-cache redirect for an enabled link", async () => {
  let requestedPath;
  const handler = createHandler({
    getLink: async (path) => {
      requestedPath = path;
      return { enabled: true };
    },
    isConfigured: () => true,
    resolve: () => ({ statusCode: 302, location: "https://example.com/" }),
    logger: silentLogger
  });

  const response = await handler(event("GET", "/download/app/"));
  assert.equal(requestedPath, "download/app");
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.Location, "https://example.com/");
  assert.match(response.headers["Cache-Control"], /no-store/);
  assert.equal(response.body, "Redirecting to https://example.com/");
});

test("returns an empty body for HEAD redirects", async () => {
  const handler = createHandler({
    getLink: async () => ({ enabled: true }),
    isConfigured: () => true,
    resolve: () => ({ statusCode: 301, location: "https://example.com/" }),
    logger: silentLogger
  });

  const response = await handler(event("HEAD"));
  assert.equal(response.statusCode, 301);
  assert.equal(response.body, "");
});

test("maps DynamoDB throttling to a retryable response", async () => {
  const error = new Error("throttled");
  error.name = "ThrottlingException";
  const handler = createHandler({
    getLink: async () => { throw error; },
    isConfigured: () => true,
    logger: silentLogger
  });

  const response = await handler(event());
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers["Retry-After"], "2");
});

test("maps a missing DynamoDB table to a retryable response", async () => {
  const error = new Error("missing table");
  error.name = "ResourceNotFoundException";
  const handler = createHandler({
    getLink: async () => {
      throw error;
    },
    isConfigured: () => true,
    logger: silentLogger
  });

  const response = await handler(event());
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers["Retry-After"], "5");
});

test("fails closed when a stored redirect is invalid", async () => {
  const handler = createHandler({
    getLink: async () => ({
      enabled: true,
      randomSubdomain: false,
      targetUrl: "javascript:alert(1)"
    }),
    isConfigured: () => true,
    logger: silentLogger
  });

  const response = await handler(event());
  assert.equal(response.statusCode, 500);
  assert.equal(response.body, "Invalid redirect configuration");
});

test("rejects methods outside the public API contract", async () => {
  const handler = createHandler({
    isConfigured: () => true,
    logger: silentLogger
  });

  const response = await handler(event("POST"));
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "GET, HEAD");
});

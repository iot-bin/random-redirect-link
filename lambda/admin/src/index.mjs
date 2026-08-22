import { ADMIN_TOKEN, hasRequiredConfig } from "./config.mjs";
import { HttpError, isThrottlingError } from "./errors.mjs";
import { batchMutateLinks } from "./handlers/batch.mjs";
import {
  createLink,
  deleteLink,
  getLink,
  listLinks,
  updateLink
} from "./handlers/links.mjs";
import { getAuth, json } from "./http.mjs";

export const handler = async (event, context) => {
  if (!hasRequiredConfig()) {
    return json(500, {
      error: "server configuration is incomplete",
      code: "CONFIG_ERROR"
    });
  }

  if (getAuth(event) !== `Bearer ${ADMIN_TOKEN}`) {
    return json(401, { error: "unauthorized", code: "UNAUTHORIZED" });
  }

  const method =
    event?.requestContext?.http?.method
    ?? event?.httpMethod
    ?? "GET";
  const rawPath = event?.rawPath ?? event?.path ?? "/";

  try {
    if (method === "POST" && rawPath === "/links/batch") {
      return await batchMutateLinks(event);
    }
    if (method === "POST" && rawPath === "/links") {
      return await createLink(event);
    }
    if (method === "GET" && rawPath === "/links") {
      return await listLinks(event);
    }
    if (method === "GET" && rawPath.startsWith("/links/")) {
      return await getLink(rawPath);
    }
    if (method === "PATCH" && rawPath.startsWith("/links/")) {
      return await updateLink(event, rawPath);
    }
    if (method === "DELETE" && rawPath.startsWith("/links/")) {
      return await deleteLink(rawPath);
    }

    return json(404, { error: "not found", code: "ROUTE_NOT_FOUND" });
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.statusCode, { error: error.message, code: error.code });
    }

    console.error(JSON.stringify({
      requestId: context?.awsRequestId,
      method,
      rawPath,
      errorName: error?.name ?? "Error"
    }));

    if (isThrottlingError(error)) {
      return json(
        503,
        {
          error: "service temporarily unavailable",
          code: "DYNAMODB_THROTTLED"
        },
        { "Retry-After": "2" }
      );
    }

    if (
      method === "GET"
      && rawPath === "/links"
      && ["ResourceNotFoundException", "ValidationException"].includes(error?.name)
    ) {
      return json(
        503,
        { error: "list index is not ready", code: "LIST_INDEX_UNAVAILABLE" },
        { "Retry-After": "5" }
      );
    }

    if (error?.name === "ResourceNotFoundException") {
      return json(
        503,
        { error: "data store is not ready", code: "DATA_STORE_UNAVAILABLE" },
        { "Retry-After": "5" }
      );
    }

    return json(500, { error: "internal error", code: "INTERNAL_ERROR" });
  }
};

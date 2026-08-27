import { hasRequiredConfig } from "./config.mjs";
import { RedirectConfigError, isThrottlingError } from "./errors.mjs";
import { redirect, text } from "./http.mjs";
import { normalizePath } from "./link-path.mjs";
import { resolveRedirect } from "./redirect.mjs";
import { getLinkByPath } from "./repository.mjs";

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

export function createHandler({
  getLink = getLinkByPath,
  isConfigured = hasRequiredConfig,
  resolve = resolveRedirect,
  logger = console
} = {}) {
  return async (event, context) => {
    if (!isConfigured()) {
      return text(500, "Server configuration is incomplete");
    }

    const method = event?.requestContext?.http?.method
      ?? event?.httpMethod
      ?? "GET";

    if (!ALLOWED_METHODS.has(method)) {
      return text(405, "Method Not Allowed", { Allow: "GET, HEAD" });
    }

    const rawPath = event?.rawPath ?? event?.path ?? "/";
    const path = normalizePath(rawPath);

    if (!path) {
      return text(404, "Not Found");
    }

    try {
      const item = await getLink(path);

      if (!item || item.enabled === false) {
        return text(404, "Not Found");
      }

      const result = resolve(item);
      return redirect(result.statusCode, result.location, {
        headRequest: method === "HEAD"
      });
    } catch (error) {
      logger.error(JSON.stringify({
        requestId: context?.awsRequestId,
        method,
        path,
        errorName: error?.name ?? "Error"
      }));

      if (error instanceof RedirectConfigError) {
        return text(500, "Invalid redirect configuration");
      }

      if (isThrottlingError(error)) {
        return text(503, "Service temporarily unavailable", {
          "Retry-After": "2"
        });
      }

      if (error?.name === "ResourceNotFoundException") {
        return text(503, "Data store is unavailable", {
          "Retry-After": "5"
        });
      }

      return text(500, "Internal error");
    }
  };
}

export const handler = createHandler();

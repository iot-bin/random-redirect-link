import { MAX_PATH_LENGTH } from "./config.mjs";
import { HttpError } from "./errors.mjs";

export function normalizePath(input) {
  return String(input ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export function getPathError(path) {
  if (!path) return "path is required";
  if (path.length > MAX_PATH_LENGTH) return "path is too long";
  if (path.includes("..")) return "path must not contain ..";
  if (path.includes("//")) return "path must not contain consecutive slashes";
  if (path.includes("?") || path.includes("#")) {
    return "path must not contain query or fragment characters";
  }
  return "";
}

export function decodePathFromRawPath(rawPath) {
  const prefix = "/links/";
  if (!rawPath?.startsWith(prefix)) return "";

  const encodedPath = rawPath.slice(prefix.length);

  try {
    return normalizePath(
      encodedPath
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/")
    );
  } catch {
    throw new HttpError(400, "INVALID_PATH", "invalid path encoding");
  }
}
// Named stages appear in rawPath on the execute-api endpoint, but not in custom-domain mappings.
export function requestPath(event) {
  const raw = event?.rawPath ?? event?.path ?? '/';
  const context = event?.requestContext;
  const stage = context?.stage;
  const directEndpoint = /^[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/.test(context?.domainName ?? '');
  if (event?.version === '2.0' && directEndpoint && stage && stage !== '$default') {
    const prefix = '/' + stage;
    if (raw === prefix) return '/';
    if (raw.startsWith(prefix + '/')) return raw.slice(prefix.length);
  }
  return raw;
}

import { HttpError } from "./errors.mjs";
import { normalizeLinkPath, linkPathIssue, requestPath } from "./link-contracts.mjs";

export const normalizePath = normalizeLinkPath;
export { requestPath };

const pathMessages = {
  required: "path is required",
  length: "path is too long",
  dot_segments: "path must not contain ..",
  double_slash: "path must not contain consecutive slashes",
  query_fragment: "path must not contain query or fragment characters"
};

export function getPathError(path) {
  const issue = linkPathIssue(path);
  return issue ? pathMessages[issue] : "";
}

export function decodePathFromRawPath(rawPath) {
  const prefix = "/links/";
  if (!rawPath?.startsWith(prefix)) return "";
  const encodedPath = rawPath.slice(prefix.length);
  try {
    return normalizePath(encodedPath.split("/").map((segment) => decodeURIComponent(segment)).join("/"));
  } catch {
    throw new HttpError(400, "INVALID_PATH", "invalid path encoding");
  }
}

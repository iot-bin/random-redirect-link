import {
  BATCH_ACTIONS,
  DEFAULT_LIMIT,
  MAX_BATCH_SIZE,
  MAX_LIMIT,
  MAX_TARGET_URL_LENGTH
} from "./config.mjs";
import { HttpError } from "./errors.mjs";
import { getPathError, normalizePath } from "./link-path.mjs";
import { parseJsonBody } from "./http.mjs";

export function parseLimit(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_LIMIT;
  }

  const raw = String(value);
  if (!/^\d+$/.test(raw)) {
    throw new HttpError(400, "INVALID_LIMIT", "limit must be an integer");
  }

  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(
      400,
      "INVALID_LIMIT",
      `limit must be between 1 and ${MAX_LIMIT}`
    );
  }

  return limit;
}

export function parsePrefix(value) {
  if (value === undefined || value === null || value === "") return "";

  const prefix = normalizePath(value);
  const error = getPathError(prefix);
  if (error) throw new HttpError(400, "INVALID_PREFIX", error);
  return prefix;
}

export function parseTargetUrl(value) {
  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "INVALID_TARGET_URL",
      "targetUrl must be a string"
    );
  }

  const targetUrl = value.trim();
  if (!targetUrl || targetUrl.length > MAX_TARGET_URL_LENGTH) {
    throw new HttpError(
      400,
      "INVALID_TARGET_URL",
      `targetUrl must contain between 1 and ${MAX_TARGET_URL_LENGTH} characters`
    );
  }

  let target;
  try {
    target = new URL(targetUrl);
  } catch {
    throw new HttpError(400, "INVALID_TARGET_URL", "invalid targetUrl");
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new HttpError(
      400,
      "INVALID_TARGET_URL",
      "targetUrl must use http or https"
    );
  }
  if (target.username || target.password) {
    throw new HttpError(
      400,
      "INVALID_TARGET_URL",
      "targetUrl must not contain credentials"
    );
  }
  if (target.search || target.hash) {
    throw new HttpError(
      400,
      "INVALID_TARGET_URL",
      "targetUrl query and fragment are not supported"
    );
  }

  return {
    targetUrl: target.toString(),
    targetBaseUrl: `${target.protocol}//${target.host}`,
    targetPath: target.pathname || "/"
  };
}

export function parseSubdomainLength(value) {
  const subdomainLength = Number(value);
  if (
    !Number.isInteger(subdomainLength)
    || subdomainLength < 3
    || subdomainLength > 32
  ) {
    throw new HttpError(
      400,
      "INVALID_SUBDOMAIN_LENGTH",
      "subdomainLength must be an integer between 3 and 32"
    );
  }
  return subdomainLength;
}

export function parseRandomSubdomain(value) {
  if (value === undefined) return true;
  if (typeof value !== "boolean") {
    throw new HttpError(
      400,
      "INVALID_RANDOM_SUBDOMAIN",
      "randomSubdomain must be a boolean"
    );
  }
  return value;
}

export function getUpdateFields(body) {
  const fields = {};

  if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
    if (typeof body.enabled !== "boolean") {
      throw new HttpError(400, "INVALID_ENABLED", "enabled must be a boolean");
    }
    fields.enabled = body.enabled;
  }

  if (Object.prototype.hasOwnProperty.call(body, "targetUrl")) {
    Object.assign(fields, parseTargetUrl(body.targetUrl));
  }

  if (Object.prototype.hasOwnProperty.call(body, "statusCode")) {
    if (body.statusCode !== 301 && body.statusCode !== 302) {
      throw new HttpError(
        400,
        "INVALID_STATUS_CODE",
        "statusCode must be 301 or 302"
      );
    }
    fields.statusCode = body.statusCode;
  }

  if (Object.prototype.hasOwnProperty.call(body, "subdomainLength")) {
    fields.subdomainLength = parseSubdomainLength(body.subdomainLength);
  }

  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, "EMPTY_UPDATE", "no editable fields provided");
  }

  return fields;
}

export function parseExpectedUpdatedAt(body) {
  if (!Object.prototype.hasOwnProperty.call(body, "expectedUpdatedAt")) {
    return undefined;
  }

  if (typeof body.expectedUpdatedAt !== "string" || !body.expectedUpdatedAt) {
    throw new HttpError(
      400,
      "INVALID_UPDATED_AT",
      "expectedUpdatedAt must be a non-empty string"
    );
  }

  return body.expectedUpdatedAt;
}

export function parseBatchRequest(event) {
  const body = parseJsonBody(event);
  const action = body.action;
  if (typeof action !== "string" || !BATCH_ACTIONS.has(action)) {
    throw new HttpError(
      400,
      "INVALID_BATCH_ACTION",
      "action must be enable, disable, or delete"
    );
  }
  if (!Array.isArray(body.paths) || body.paths.length === 0) {
    throw new HttpError(400, "INVALID_PATHS", "paths must be a non-empty array");
  }
  if (body.paths.length > MAX_BATCH_SIZE) {
    throw new HttpError(
      400,
      "BATCH_LIMIT_EXCEEDED",
      `batch size must not exceed ${MAX_BATCH_SIZE}`
    );
  }

  const paths = [];
  const seen = new Set();
  for (const value of body.paths) {
    if (typeof value !== "string") {
      throw new HttpError(400, "INVALID_PATHS", "every path must be a string");
    }
    const path = normalizePath(value);
    const error = getPathError(path);
    if (error) throw new HttpError(400, "INVALID_PATHS", error);
    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }

  return { action, paths };
}

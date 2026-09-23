import {
  DEFAULT_LIMIT,
  MAX_BATCH_SIZE,
  MAX_LIMIT,
  MAX_TARGET_URL_LENGTH
} from "./config.mjs";
import { scheduleFields } from "./lifecycle.mjs";
import { HttpError } from "./errors.mjs";
import { getPathError, normalizePath } from "./link-path.mjs";
import { parseJsonBody } from "./http.mjs";
import { isLinkBatchAction, isLinkStatusCode, targetUrlIssue, splitTargetUrl, isSubdomainLength } from './link-contracts.mjs';

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
  const issue = targetUrlIssue(value);
  if (issue) {
    const messages = {
      type: 'targetUrl must be a string',
      required: `targetUrl must contain between 1 and ${MAX_TARGET_URL_LENGTH} characters`,
      length: `targetUrl must contain between 1 and ${MAX_TARGET_URL_LENGTH} characters`,
      invalid: 'invalid targetUrl',
      protocol: 'targetUrl must use http or https',
      credentials: 'targetUrl must not contain credentials',
      query_fragment: 'targetUrl query and fragment are not supported'
    };
    throw new HttpError(400, 'INVALID_TARGET_URL', messages[issue]);
  }
  return splitTargetUrl(value);
}

export function parseSubdomainLength(value) {
  const subdomainLength = Number(value);
  if (!isSubdomainLength(subdomainLength)) {
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
  const fields = scheduleFields(body);
  if (Object.hasOwn(body, 'restore')) {
    if (body.restore !== true) throw new HttpError(400, 'INVALID_SCHEDULE', 'restore must be true');
    fields.restore = true;
  }

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
    if (!isLinkStatusCode(body.statusCode)) {
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
  if (!isLinkBatchAction(action)) {
    throw new HttpError(
      400,
      "INVALID_BATCH_ACTION",
      "action must be enable, disable, delete, or restore"
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

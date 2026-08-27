import { randomBytes as secureRandomBytes } from "node:crypto";
import {
  DEFAULT_STATUS_CODE,
  DEFAULT_SUBDOMAIN_LENGTH,
  MAX_SUBDOMAIN_LENGTH,
  MIN_SUBDOMAIN_LENGTH
} from "./config.mjs";
import { RedirectConfigError } from "./errors.mjs";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ALLOWED_STATUS_CODES = new Set([301, 302]);

function parseHttpUrl(value, fieldName) {
  const rawValue = String(value ?? "").trim();

  try {
    const parsed = new URL(rawValue);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error("unsupported URL");
    }
    return { parsed, rawValue };
  } catch {
    throw new RedirectConfigError(`invalid ${fieldName}`);
  }
}

export function parseStatusCode(value) {
  const statusCode = Number(value ?? DEFAULT_STATUS_CODE);
  if (!ALLOWED_STATUS_CODES.has(statusCode)) {
    throw new RedirectConfigError("invalid statusCode");
  }
  return statusCode;
}

export function parseSubdomainLength(value) {
  const length = Number(value ?? DEFAULT_SUBDOMAIN_LENGTH);
  if (
    !Number.isInteger(length)
    || length < MIN_SUBDOMAIN_LENGTH
    || length > MAX_SUBDOMAIN_LENGTH
  ) {
    throw new RedirectConfigError("invalid subdomainLength");
  }
  return length;
}

export function randomSubdomain(length, randomBytes = secureRandomBytes) {
  const bytes = randomBytes(length);
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += ALPHABET[bytes[index] % ALPHABET.length];
  }

  return value;
}

export function buildRandomTargetUrl(
  targetBaseUrl,
  targetPath,
  subdomainLength,
  randomBytes = secureRandomBytes
) {
  const { parsed: baseUrl } = parseHttpUrl(targetBaseUrl, "targetBaseUrl");
  const subdomain = randomSubdomain(subdomainLength, randomBytes);
  baseUrl.hostname = `${subdomain}.${baseUrl.hostname}`;

  const path = String(targetPath ?? "/");
  baseUrl.pathname = path.startsWith("/") ? path : `/${path}`;

  return baseUrl.toString();
}

export function resolveRedirect(item, { randomBytes = secureRandomBytes } = {}) {
  const statusCode = parseStatusCode(item?.statusCode);

  if (item?.randomSubdomain === true) {
    const subdomainLength = parseSubdomainLength(item.subdomainLength);
    return {
      statusCode,
      location: buildRandomTargetUrl(
        item.targetBaseUrl,
        item.targetPath,
        subdomainLength,
        randomBytes
      )
    };
  }

  const { rawValue: location } = parseHttpUrl(item?.targetUrl, "targetUrl");
  return { statusCode, location };
}

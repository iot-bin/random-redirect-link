import { HttpError } from "./errors.mjs";

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function getAuth(event) {
  const headers = event?.headers ?? {};
  return headers.authorization ?? headers.Authorization ?? "";
}

export function parseJsonBody(event) {
  try {
    const rawBody = event?.isBase64Encoded
      ? Buffer.from(event?.body ?? "", "base64").toString("utf8")
      : event?.body ?? "{}";
    const body = JSON.parse(rawBody);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("body must be an object");
    }

    return body;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "invalid JSON body");
  }
}

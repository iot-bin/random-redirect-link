import {
  LIST_PARTITION_ATTRIBUTE,
  LIST_PARTITION_VALUE,
  MAX_CURSOR_LENGTH
} from "./config.mjs";
import { HttpError } from "./errors.mjs";

export function encodeCursor(key, prefix) {
  if (!key) return null;
  return Buffer.from(
    JSON.stringify({ v: 1, prefix, key }),
    "utf8"
  ).toString("base64url");
}

export function decodeCursor(value, prefix) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const cursor = String(value);
  if (
    cursor.length > MAX_CURSOR_LENGTH
    || !/^[A-Za-z0-9_-]+$/.test(cursor)
  ) {
    throw new HttpError(400, "INVALID_CURSOR", "invalid cursor");
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );
    const key = decoded?.key;
    const keyNames =
      key && typeof key === "object" ? Object.keys(key).sort() : [];

    if (
      decoded?.v !== 1
      || decoded?.prefix !== prefix
      || typeof key !== "object"
      || key === null
      || keyNames.length !== 2
      || keyNames[0] !== LIST_PARTITION_ATTRIBUTE
      || keyNames[1] !== "path"
      || key[LIST_PARTITION_ATTRIBUTE] !== LIST_PARTITION_VALUE
      || typeof key.path !== "string"
      || !key.path
    ) {
      throw new Error("invalid cursor structure");
    }

    return key;
  } catch {
    throw new HttpError(400, "INVALID_CURSOR", "invalid cursor");
  }
}

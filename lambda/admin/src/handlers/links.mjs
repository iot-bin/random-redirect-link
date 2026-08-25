import { decodeCursor, encodeCursor } from "../cursor.mjs";
import { HttpError } from "../errors.mjs";
import { json, parseJsonBody } from "../http.mjs";
import { decodePathFromRawPath, getPathError, normalizePath } from "../link-path.mjs";
import { createLinkItem, toPublicItem } from "../link-record.mjs";
import {
  createLinkRecord,
  deleteLinkRecord,
  getLinkRecord,
  listLinkRecords,
  updateLinkRecord
} from "../repository.mjs";
import {
  getUpdateFields,
  parseExpectedUpdatedAt,
  parseLimit,
  parsePrefix,
  parseRandomSubdomain,
  parseSubdomainLength,
  parseTargetUrl
} from "../validation.mjs";

export async function createLink(event) {
  const body = parseJsonBody(event);
  if (typeof body.path !== "string") {
    throw new HttpError(400, "INVALID_PATH", "path must be a string");
  }

  const path = normalizePath(body.path);
  const pathError = getPathError(path);
  if (pathError) throw new HttpError(400, "INVALID_PATH", pathError);

  const randomSubdomain = parseRandomSubdomain(body.randomSubdomain);
  const target = parseTargetUrl(body.targetUrl);
  const subdomainLength = randomSubdomain
    ? parseSubdomainLength(body.subdomainLength ?? 10)
    : undefined;
  const item = createLinkItem({
    path,
    target,
    randomSubdomain,
    subdomainLength
  });

  await createLinkRecord(item);
  return json(201, toPublicItem(item));
}

export async function listLinks(event) {
  const query = event?.queryStringParameters ?? {};
  const limit = parseLimit(query.limit);
  const prefix = parsePrefix(query.prefix);
  const exclusiveStartKey = decodeCursor(query.cursor, prefix);
  const response = await listLinkRecords({ limit, prefix, exclusiveStartKey });

  return json(200, {
    items: (response.Items ?? []).map(toPublicItem),
    nextCursor: encodeCursor(response.LastEvaluatedKey, prefix)
  });
}

export async function getLink(rawPath) {
  const path = decodePathFromRawPath(rawPath);
  const pathError = getPathError(path);
  if (pathError) throw new HttpError(400, "INVALID_PATH", pathError);

  const item = await getLinkRecord(path);
  if (!item) {
    throw new HttpError(404, "LINK_NOT_FOUND", "not found");
  }
  return json(200, toPublicItem(item));
}

export async function deleteLink(rawPath) {
  const path = decodePathFromRawPath(rawPath);
  const pathError = getPathError(path);
  if (pathError) throw new HttpError(400, "INVALID_PATH", pathError);

  const deleted = await deleteLinkRecord(path);
  if (!deleted) {
    throw new HttpError(404, "LINK_NOT_FOUND", "not found");
  }
  return json(200, { deleted: true, path });
}

export async function updateLink(event, rawPath) {
  const path = decodePathFromRawPath(rawPath);
  const pathError = getPathError(path);
  if (pathError) throw new HttpError(400, "INVALID_PATH", pathError);

  const body = parseJsonBody(event);
  const fields = getUpdateFields(body);
  const expectedUpdatedAt = parseExpectedUpdatedAt(body);
  const item = await updateLinkRecord(path, fields, expectedUpdatedAt);

  return json(200, toPublicItem(item));
}

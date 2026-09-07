import { lifecycleUpdate, RETENTION_SECONDS } from "./lifecycle.mjs";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import {
  LINKS_INDEX_NAME,
  LIST_PARTITION_ATTRIBUTE,
  LIST_PARTITION_VALUE,
  TABLE_NAME
} from "./config.mjs";
import { ddb } from "./dynamodb.mjs";
import { HttpError } from "./errors.mjs";

export async function createLinkRecord(item) {
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(#path)",
        ExpressionAttributeNames: { "#path": "path" }
      })
    );
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      throw new HttpError(409, "LINK_CONFLICT", "path already exists");
    }
    throw error;
  }
}

export async function listLinkRecords({
  limit,
  prefix,
  exclusiveStartKey,
  view = "links"
}) {
  const expressionAttributeNames = { "#listPk": LIST_PARTITION_ATTRIBUTE };
  const expressionAttributeValues = { ":listPk": LIST_PARTITION_VALUE };
  let keyConditionExpression = "#listPk = :listPk";

  if (prefix) {
    expressionAttributeNames["#path"] = "path";
    expressionAttributeValues[":prefix"] = prefix;
    keyConditionExpression += " AND begins_with(#path, :prefix)";
  }

  expressionAttributeNames["#deletedAt"] = "deletedAt";
  const items = [];
  let key = exclusiveStartKey;
  // Bound work per request, preserving the cursor even when a filtered page is empty.
  for (let page = 0; page < 20; page++) {
    const response = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: LINKS_INDEX_NAME,
        KeyConditionExpression: keyConditionExpression,
        FilterExpression:
          view === "trash"
            ? "attribute_exists(#deletedAt)"
            : "attribute_not_exists(#deletedAt)",
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit - items.length,
        ...(key ? { ExclusiveStartKey: key } : {}),
        ScanIndexForward: true
      })
    );
    items.push(...(response.Items ?? []));
    key = response.LastEvaluatedKey;
    if (!key || items.length >= limit) break;
  }
  return { Items: items, LastEvaluatedKey: key };
}

export async function getLinkRecord(path) {
  const response = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { path },
      ConsistentRead: true
    })
  );
  return response.Item;
}

// Every mutation compares the snapshot read above, including legacy records.
async function writeFields(path, fields, current, expectedUpdatedAt) {
  if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) {
    throw new HttpError(
      409,
      "LINK_VERSION_CONFLICT",
      "link was updated by another request"
    );
  }
  const names = { "#path": "path", "#version": "updatedAt" };
  const values = {};
  const set = [],
    remove = [];
  // Ensure sequential writes cannot share the same version within one millisecond.
  const updatedAt = new Date(
    Math.max(Date.now(), (Date.parse(current.updatedAt) || 0) + 1)
  ).toISOString();
  for (const [key, value] of Object.entries({ ...fields, updatedAt })) {
    const alias = "#f" + Object.keys(names).length;
    names[alias] = key;
    if (value === null) remove.push(alias);
    else {
      const token = ":v" + Object.keys(values).length;
      values[token] = value;
      set.push(alias + " = " + token);
    }
  }
  let condition = "attribute_exists(#path) AND ";
  if (current.updatedAt) {
    condition += "#version = :version";
    values[":version"] = current.updatedAt;
  } else condition += "attribute_not_exists(#version)";
  try {
    const response = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { path },
        UpdateExpression:
          "SET " +
          set.join(", ") +
          (remove.length ? " REMOVE " + remove.join(", ") : ""),
        ConditionExpression: condition,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW"
      })
    );
    return response.Attributes;
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException")
      throw new HttpError(
        409,
        "LINK_VERSION_CONFLICT",
        "Refresh and retry; the link changed"
      );
    throw error;
  }
}
export async function deleteLinkRecord(path) {
  const current = await getLinkRecord(path);
  if (!current) return undefined;
  if (current.deletedAt) return current;
  const now = Date.now();
  if (current.purgeAt != null && current.purgeAt <= now / 1000)
    throw new HttpError(409, "RETENTION_ENDED", "Retention period has ended");
  return writeFields(
    path,
    {
      deletedAt: new Date(now).toISOString(),
      purgeAt: Math.ceil(now / 1000) + RETENTION_SECONDS
    },
    current
  );
}
export async function updateLinkRecord(path, fields, expectedUpdatedAt) {
  const current = await getLinkRecord(path);
  if (!current) throw new HttpError(404, "LINK_NOT_FOUND", "not found");
  return writeFields(
    path,
    lifecycleUpdate(current, fields),
    current,
    expectedUpdatedAt
  );
}
export async function deleteLinkRecordIfExists(path) {
  const item = await deleteLinkRecord(path);
  if (!item) throw new HttpError(404, "LINK_NOT_FOUND", "not found");
  return item;
}
export async function restoreLinkRecord(path) {
  return updateLinkRecord(path, { restore: true });
}
export async function updateLinkEnabledIfExists(path, enabled) {
  return updateLinkRecord(path, { enabled });
}

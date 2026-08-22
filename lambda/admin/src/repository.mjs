import {
  DeleteCommand,
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
  exclusiveStartKey
}) {
  const expressionAttributeNames = { "#listPk": LIST_PARTITION_ATTRIBUTE };
  const expressionAttributeValues = { ":listPk": LIST_PARTITION_VALUE };
  let keyConditionExpression = "#listPk = :listPk";

  if (prefix) {
    expressionAttributeNames["#path"] = "path";
    expressionAttributeValues[":prefix"] = prefix;
    keyConditionExpression += " AND begins_with(#path, :prefix)";
  }

  return ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: LINKS_INDEX_NAME,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      ScanIndexForward: true
    })
  );
}

export async function getLinkRecord(path) {
  const response = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { path } })
  );
  return response.Item;
}

export async function deleteLinkRecord(path) {
  const response = await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { path },
      ReturnValues: "ALL_OLD"
    })
  );
  return response.Attributes;
}

export async function updateLinkRecord(path, fields, expectedUpdatedAt) {
  const now = new Date().toISOString();
  const names = {
    "#path": "path",
    "#updatedAt": "updatedAt"
  };
  const values = { ":updatedAt": now };
  const assignments = ["#updatedAt = :updatedAt"];

  for (const [name, value] of Object.entries(fields)) {
    names[`#${name}`] = name;
    values[`:${name}`] = value;
    assignments.push(`#${name} = :${name}`);
  }

  let conditionExpression = "attribute_exists(#path)";
  if (expectedUpdatedAt) {
    values[":expectedUpdatedAt"] = expectedUpdatedAt;
    conditionExpression += " AND #updatedAt = :expectedUpdatedAt";
  }

  try {
    const response = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { path },
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ConditionExpression: conditionExpression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW"
      })
    );
    return response.Attributes;
  } catch (error) {
    if (error?.name !== "ConditionalCheckFailedException") throw error;

    if (expectedUpdatedAt) {
      const existing = await getLinkRecord(path);
      if (existing) {
        throw new HttpError(
          409,
          "LINK_VERSION_CONFLICT",
          "link was updated by another request"
        );
      }
    }

    throw new HttpError(404, "LINK_NOT_FOUND", "not found");
  }
}

export async function deleteLinkRecordIfExists(path) {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { path },
      ConditionExpression: "attribute_exists(#path)",
      ExpressionAttributeNames: { "#path": "path" }
    })
  );
}

export async function updateLinkEnabledIfExists(path, enabled) {
  const response = await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { path },
      UpdateExpression: "SET #enabled = :enabled, #updatedAt = :updatedAt",
      ConditionExpression: "attribute_exists(#path)",
      ExpressionAttributeNames: {
        "#path": "path",
        "#enabled": "enabled",
        "#updatedAt": "updatedAt"
      },
      ExpressionAttributeValues: {
        ":enabled": enabled,
        ":updatedAt": new Date().toISOString()
      },
      ReturnValues: "ALL_NEW"
    })
  );
  return response.Attributes;
}

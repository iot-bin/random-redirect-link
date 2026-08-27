import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAME } from "./config.mjs";
import { ddb } from "./dynamodb.mjs";

export async function getLinkByPath(path) {
  const response = await ddb.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { path }
  }));

  return response.Item;
}

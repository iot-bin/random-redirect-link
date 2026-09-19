import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { HttpError } from './domain.mjs';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }), { marshallOptions: { removeUndefinedValues: true } });
const pk = 'WS#' + process.env.WORKSPACE_ID;
const table = process.env.CONFIG_TABLE;
const strip = item => item && Object.fromEntries(Object.entries(item).filter(([k]) => !['pk', 'sk'].includes(k)));
export const repository = {
  async get(sk) {
    const r = await client.send(new GetCommand({ TableName: table, Key: { pk, sk }, ConsistentRead: true }));
    return strip(r.Item);
  },
  async put(sk, item, expectedVersion) {
    try {
      await client.send(new PutCommand({ TableName: table, Item: { ...item, pk, sk },
        ...(expectedVersion === undefined ? {} : expectedVersion === 0
          ? { ConditionExpression: 'attribute_not_exists(pk)' }
          : { ConditionExpression: '#v = :v', ExpressionAttributeNames: { '#v': 'version' }, ExpressionAttributeValues: { ':v': expectedVersion } }),
      }));
    } catch (e) { if (e.name === 'ConditionalCheckFailedException') throw new HttpError(409, 'VERSION_CONFLICT'); throw e; }
  },
  async listMembers() {
    const items = []; let key;
    do {
      const r = await client.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': pk, ':prefix': 'MEMBER#' }, ConsistentRead: true, ExclusiveStartKey: key }));
      items.push(...r.Items.map(strip)); key = r.LastEvaluatedKey;
    } while (key);
    return items;
  },
  async audit(item) {
    await client.send(new PutCommand({ TableName: process.env.AUDIT_TABLE, Item: { ...item, pk, sk: item.at + '#' + item.id + '#' + item.phase } }));
  },
  async listAudit() {
    const r = await client.send(new QueryCommand({ TableName: process.env.AUDIT_TABLE, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': pk }, ScanIndexForward: false, Limit: 100 }));
    return r.Items.map(strip);
  },
};

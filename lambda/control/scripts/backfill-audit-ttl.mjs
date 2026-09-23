import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { auditPurgeAt } from '../src/audit-retention.mjs';

const apply = process.argv.includes('--apply');
const table = process.env.AUDIT_TABLE;
const workspaceId = process.env.WORKSPACE_ID;
const region = process.env.AWS_REGION;
const retentionDays = Number(process.env.AUDIT_RETENTION_DAYS ?? 30);

if (!table || !/^[a-z0-9-]{1,40}$/.test(workspaceId ?? '') || !region
  || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
  throw new Error('Set AUDIT_TABLE, WORKSPACE_ID, AWS_REGION, and a valid AUDIT_RETENTION_DAYS (default 30).');
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const pk = `WS#${workspaceId}`;
let cursor;
let inspected = 0;
let pendingUpdates = 0;
let updated = 0;
let invalidTimestamp = 0;

do {
  const page = await client.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': pk },
    ConsistentRead: true,
    ExclusiveStartKey: cursor,
  }));

  for (const item of page.Items ?? []) {
    inspected += 1;
    const purgeAt = auditPurgeAt(item.at, retentionDays);
    if (!Number.isFinite(purgeAt)) {
      invalidTimestamp += 1;
      continue;
    }
    if (item.purgeAt === purgeAt) continue;
    pendingUpdates += 1;
    if (!apply) continue;

    const hasPreviousTtl = item.purgeAt !== undefined;
    try {
      await client.send(new UpdateCommand({
        TableName: table,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression: 'SET purgeAt = :purgeAt',
        ConditionExpression: hasPreviousTtl ? 'purgeAt = :previous' : 'attribute_not_exists(purgeAt)',
        ExpressionAttributeValues: { ':purgeAt': purgeAt, ...(hasPreviousTtl ? { ':previous': item.purgeAt } : {}) },
      }));
      updated += 1;
    } catch (error) {
      if (error.name !== 'ConditionalCheckFailedException') throw error;
    }
  }
  cursor = page.LastEvaluatedKey;
} while (cursor);

console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', inspected, pendingUpdates, updated, invalidTimestamp }));

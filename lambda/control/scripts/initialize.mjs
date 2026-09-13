// Explicit operator action only. Does not create users, send mail, or alter backend APIs.
import { readFile, writeFile } from 'node:fs/promises';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { validateConfig } from '../src/domain.mjs';
const [outputsPath, configPath, ownerUsername, workspace = 'main'] = process.argv.slice(2);
if (!outputsPath || !configPath || !ownerUsername || !/^[a-z0-9-]{1,40}$/.test(workspace)) {
  throw new Error('Usage: node scripts/initialize.mjs stack-outputs.json workspace.json owner-email [workspace-id]');
}
const data = JSON.parse(await readFile(outputsPath, 'utf8'));
const outputs = Object.fromEntries((data.Stacks?.[0]?.Outputs ?? data).map(o => [o.OutputKey, o.OutputValue]));
for (const key of ['Region','UserPoolId','CognitoClientId','ConfigurationTable','ManagementApiUrl']) if (!outputs[key]) throw new Error('Missing stack output: ' + key);
const region = outputs.Region;
const cognito = new CognitoIdentityProviderClient({ region });
const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: outputs.UserPoolId, Username: ownerUsername }));
if (!user.Enabled) throw new Error('Owner account must be enabled');
const sub = user.UserAttributes.find(a => a.Name === 'sub')?.Value;
if (!sub) throw new Error('Owner subject is missing');
const input = JSON.parse(await readFile(configPath, 'utf8'));
const apiIds = (outputs.BackendApiIds ?? '').split(',');
const config = validateConfig({...input,version:0}, apiIds);
const pk = 'WS#' + workspace;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
// Atomic, create-only bootstrap: re-running cannot overwrite permissions or configuration.
await db.send(new TransactWriteCommand({ TransactItems: [
  ['CONFIG',config], ['OWNER',{sub}], ['MEMBER#'+sub,{sub,email:ownerUsername,role:'admin',active:true,grants:{},version:1}],
].map(([sk,item]) => ({Put:{TableName:outputs.ConfigurationTable,Item:{...item,pk,sk},ConditionExpression:'attribute_not_exists(pk)'}})) }));
await writeFile(new URL('../../../config/bootstrap.local.json', import.meta.url), JSON.stringify({region,managementApiUrl:outputs.ManagementApiUrl,cognitoClientId:outputs.CognitoClientId},null,2)+'\n');
console.log('Workspace initialized. Deployment coordinates written to ignored local configuration.');

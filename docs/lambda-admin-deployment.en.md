# Admin Lambda Deployment Guide

[简体中文](lambda-admin-deployment.zh-CN.md) | English

This guide packages and deploys the modular `random-redirect-link-admin` Lambda
source and verifies its API Gateway integration. The examples use:

- AWS CLI profile: `your-aws-profile`
- Region: `ap-southeast-1`
- Function: `random-redirect-link-admin`
- HTTP API ID: `ADMIN_API_ID`
- DynamoDB table: `random-redirect-link`
- Listing GSI: `links-by-path`

Confirm the account and Region before running any command. The Admin API requires IAM
authentication from the designated management role. See [Management service](control-plane.en.md).

## 1. Package Model

The source lives in `lambda/admin/src` and esbuild produces one `index.mjs` at
the ZIP root. Keep the Lambda handler set to:

```text
index.handler
```

The recommended package externalizes `@aws-sdk/*` and uses the SDK v3 included
in the Node.js 24 Lambda runtime. The optional self-contained package pins and
includes the SDK but is larger and must be updated by the application owner.

## 2. Local Requirements

- Node.js 24, or a locally compatible Node.js version
- pnpm 11
- PowerShell 7
- AWS CLI v2

Install dependencies from the repository root:

```powershell
pnpm --dir lambda/admin install --frozen-lockfile
```

## 3. Test and Create the ZIP

Create the recommended package:

```powershell
pnpm --dir lambda/admin package
```

The command runs unit tests, bundles the modules, and writes:

```text
lambda/admin/dist/random-redirect-link-admin.zip
```

Create the optional self-contained package only when pinned SDK dependencies
are required:

```powershell
pnpm --dir lambda/admin package:self-contained
```

Verify that `index.mjs` is at the ZIP root:

```powershell
$verifyDirectory = Join-Path $env:TEMP "random-redirect-link-admin-verify"
if (Test-Path -LiteralPath $verifyDirectory) {
  Remove-Item -LiteralPath $verifyDirectory -Recurse -Force
}
Expand-Archive `
  -LiteralPath "lambda/admin/dist/random-redirect-link-admin.zip" `
  -DestinationPath $verifyDirectory
Get-ChildItem -LiteralPath $verifyDirectory
```

## 4. Verify the AWS Target

```powershell
aws sts get-caller-identity --profile your-aws-profile

aws lambda get-function-configuration `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile your-aws-profile `
  --query "{Runtime:Runtime,Handler:Handler,Timeout:Timeout,State:State,LastUpdateStatus:LastUpdateStatus}"
```

Expected configuration:

- Runtime: `nodejs24.x`
- Handler: `index.handler`
- Timeout: `10`
- State: `Active`

Preserve the existing values of:

- `TABLE_NAME`
- `MANAGEMENT_ROLE_ARN`
- `WRITE_DISABLED`
- `LINKS_INDEX_NAME` (defaults to `links-by-path` in code)

Do not update the `Environment.Variables` object unless every current value has
first been backed up; Lambda replaces the complete map.

## 5. Least-Privilege IAM

The execution role needs CloudWatch Logs permissions, normally through
`AWSLambdaBasicExecutionRole`, plus these DynamoDB data-plane actions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/random-redirect-link",
        "arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/random-redirect-link/index/links-by-path"
      ]
    }
  ]
}
```

Replace `ACCOUNT_ID`. Do not grant table creation, table deletion, or wildcard
access to every DynamoDB resource.

## 6. Back Up the Current Function

Download the current `$LATEST` package before changing code:

```powershell
$backupDirectory = Join-Path $PWD "lambda/admin/backups"
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDirectory "random-redirect-link-admin-$timestamp.zip"

$codeUrl = aws lambda get-function `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile your-aws-profile `
  --query "Code.Location" `
  --output text

Invoke-WebRequest -Uri $codeUrl -OutFile $backupPath
Remove-Variable codeUrl
```

The backup directory is ignored by Git. The temporary download URL must not be
printed, shared, or committed.

## 7. Upload the Code

```powershell
aws lambda update-function-code `
  --function-name random-redirect-link-admin `
  --zip-file "fileb://lambda/admin/dist/random-redirect-link-admin.zip" `
  --region ap-southeast-1 `
  --profile your-aws-profile

aws lambda wait function-updated `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile your-aws-profile
```

Verify `State=Active` and `LastUpdateStatus=Successful` before testing.

## 8. Verify API Gateway

The Admin HTTP API requires:

```text
GET    /links
POST   /links
GET    /links/{proxy+}
PATCH  /links/{proxy+}
DELETE /links/{proxy+}
POST   /links/batch
```

Check that every route has an integration target:

```powershell
aws apigatewayv2 get-routes `
  --api-id ADMIN_API_ID `
  --region ap-southeast-1 `
  --profile your-aws-profile `
  --query "Items[].{Route:RouteKey,Target:Target,Auth:AuthorizationType}" `
  --output table
```

Check the actual stage and auto-deploy setting; SAM uses the `Environment` stage. Code-only Lambda updates do not require a new API Gateway deployment.

Every Admin route, including any ANY or $default route, must use `AWS_IAM`. Use payload format 2.0. The handler verifies the API Gateway IAM caller against `MANAGEMENT_ROLE_ARN`; the control role also needs scoped `execute-api:Invoke` permissions. Restrict direct `lambda:InvokeFunction` access to trusted operators.

## 9. Smoke Test

Use an authorized test environment through the console to exercise Cognito, membership checks and IAM signing:

1. Sign in as an editor or administrator with access to the environment.
2. Create a unique fixed-target link to `https://example.com/`; confirm it appears in the list.
3. Disable it, then batch-enable it and confirm there are no batch failures.
4. Verify GET and HEAD redirects through the public URL.
5. Delete it, confirm it appears in the recycle bin, restore it, then delete the test link again.
6. Confirm a viewer cannot mutate links and a member cannot access an unassigned environment.
7. Confirm unsigned Admin API calls and calls from a different IAM role are rejected.

Deletion is soft deletion; the path stays reserved until physical cleanup.

## 10. Logs and Rollback

```powershell
aws logs tail "/aws/lambda/random-redirect-link-admin" `
  --since 15m `
  --region ap-southeast-1 `
  --profile your-aws-profile
```

If the deployment fails, upload the backup ZIP from section 6 with
`aws lambda update-function-code`, then wait for `function-updated` again.
Code rollback does not revert environment variables, IAM, or API Gateway routes;
restore those separately if they were changed. Keep `AWS_IAM` and the designated-role check enabled; use a compatible IAM-authenticated backup.

## Link lifecycle

DELETE soft-deletes links. Restore uses PATCH with `restore:true` or batch action `restore`. DynamoDB TTL uses numeric `purgeAt`, not `expiresAt`. See [lifecycle behavior](../README.md#recycle-bin-and-link-schedules).

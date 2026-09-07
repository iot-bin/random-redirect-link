# Admin Lambda Deployment Guide

[简体中文](lambda-admin-deployment.zh-CN.md) | English

This guide packages and deploys the modular `random-redirect-link-admin` Lambda
source and verifies its API Gateway integration. The examples use:

- AWS CLI profile: `mcp-prod-02`
- Region: `ap-southeast-1`
- Function: `random-redirect-link-admin`
- HTTP API ID: `h2ocs5m4ra`
- DynamoDB table: `random-redirect-link`
- Listing GSI: `links-by-path`

Confirm the account and Region before running any command. Never place the Admin
token in Git, a command line, logs, or a deployment package.

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
aws sts get-caller-identity --profile mcp-prod-02

aws lambda get-function-configuration `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "{Runtime:Runtime,Handler:Handler,Timeout:Timeout,State:State,LastUpdateStatus:LastUpdateStatus}"
```

Expected configuration:

- Runtime: `nodejs24.x`
- Handler: `index.handler`
- Timeout: `10`
- State: `Active`

Preserve the existing values of:

- `TABLE_NAME`
- `ADMIN_TOKEN`
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
  --profile mcp-prod-02 `
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
  --profile mcp-prod-02

aws lambda wait function-updated `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

Verify `State=Active` and `LastUpdateStatus=Successful` before testing.

## 8. Verify API Gateway

The Admin HTTP API requires:

```text
GET    /links
POST   /links
GET    /{path+}
PATCH  /{path+}
DELETE /{path+}
POST   /links/batch
```

Check that every route has an integration target:

```powershell
aws apigatewayv2 get-routes `
  --api-id h2ocs5m4ra `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "Items[].{Route:RouteKey,Target:Target}" `
  --output table
```

The current `$default` stage auto-deploys route changes. Code-only Lambda
updates do not require a new API Gateway deployment.

API Gateway currently leaves these routes unauthenticated. The Lambda must
therefore keep validating `Authorization: Bearer <ADMIN_TOKEN>` on every route.

## 9. Smoke Test

The following flow creates a temporary fixed link, disables it, batch-enables
it, and deletes it. Supply the token interactively:

```powershell
$adminBaseUrl = "https://h2ocs5m4ra.execute-api.ap-southeast-1.amazonaws.com"
$secureToken = Read-Host "Admin token" -AsSecureString
$adminToken = [Net.NetworkCredential]::new("", $secureToken).Password
$headers = @{ Authorization = "Bearer $adminToken" }
$testPath = "deployment-smoke-$(Get-Date -Format 'yyyyMMddHHmmss')"

$created = Invoke-RestMethod `
  -Method Post `
  -Uri "$adminBaseUrl/links" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    path = $testPath
    targetUrl = "https://example.com/"
    randomSubdomain = $false
  } | ConvertTo-Json -Compress)

$disabled = Invoke-RestMethod `
  -Method Patch `
  -Uri "$adminBaseUrl/links/$testPath" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    enabled = $false
    expectedUpdatedAt = $created.updatedAt
  } | ConvertTo-Json -Compress)

$batchResult = Invoke-RestMethod `
  -Method Post `
  -Uri "$adminBaseUrl/links/batch" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ action = "enable"; paths = @($testPath) } | ConvertTo-Json -Compress)

$deleted = Invoke-RestMethod `
  -Method Delete `
  -Uri "$adminBaseUrl/links/$testPath" `
  -Headers $headers

$created, $disabled, $batchResult, $deleted
Remove-Variable adminToken, secureToken, headers
```

Confirm HTTP `201`, `enabled=false`, no batch failures, and `deleted=true`.

## 10. Logs and Rollback

```powershell
aws logs tail "/aws/lambda/random-redirect-link-admin" `
  --since 15m `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

If the deployment fails, upload the backup ZIP from section 6 with
`aws lambda update-function-code`, then wait for `function-updated` again.
Code rollback does not revert environment variables, IAM, or API Gateway routes;
restore those separately if they were changed.

## Lifecycle rollout

Deploy the public Lambda lifecycle checks before deploying this admin version. DELETE now soft-deletes; restore uses the existing PATCH route (restore:true) or batch action restore. After application verification, enable DynamoDB TTL on the numeric purgeAt attribute. Do not use expiresAt as the TTL field. See [lifecycle behavior](../README.md#recycle-bin-and-link-schedules).

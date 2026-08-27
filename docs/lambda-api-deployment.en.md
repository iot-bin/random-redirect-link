# Public API Lambda Deployment Guide

[简体中文](lambda-api-deployment.zh-CN.md) | English

This guide packages and deploys the public `random-redirect-link-api` Lambda.
The examples use:

- AWS CLI profile: `mcp-prod-02`
- Region: `ap-southeast-1`
- Function: `random-redirect-link-api`
- HTTP API ID: `fvdc52ex62`
- DynamoDB table: `random-redirect-link`

The public function is intentionally unauthenticated because visitors must be
able to open short links. Keep its IAM role read-only and apply throttling and
monitoring at the API and account level.

## 1. Behavior and Package Model

The function:

1. Normalizes the incoming path.
2. reads the matching DynamoDB item by the `path` partition key;
3. returns `404` when the record is missing or `enabled` is `false`;
4. builds either a random-subdomain target or a fixed `targetUrl`;
5. returns a no-cache `301` or `302` response.

`HEAD` returns the same redirect status and headers as `GET` with an empty body.
The handler remains:

```text
index.handler
```

The recommended package externalizes `@aws-sdk/*` and uses the SDK v3 included
in the Node.js 24 Lambda runtime. A self-contained package is available when a
pinned SDK version is required.

## 2. Local Requirements

- Node.js 24, or a locally compatible Node.js version
- pnpm 11
- PowerShell 7
- AWS CLI v2

Install dependencies:

```powershell
pnpm --dir lambda/api install --frozen-lockfile
```

## 3. Test and Create the ZIP

```powershell
pnpm --dir lambda/api package
```

This runs unit tests, creates a single ESM bundle, and writes:

```text
lambda/api/dist/random-redirect-link-api.zip
```

The ZIP root must contain `index.mjs`, not another `dist` or `api` directory.
Create the optional self-contained package with:

```powershell
pnpm --dir lambda/api package:self-contained
```

Verify the default ZIP:

```powershell
$verifyDirectory = Join-Path $env:TEMP "random-redirect-link-api-verify"
if (Test-Path -LiteralPath $verifyDirectory) {
  Remove-Item -LiteralPath $verifyDirectory -Recurse -Force
}
Expand-Archive `
  -LiteralPath "lambda/api/dist/random-redirect-link-api.zip" `
  -DestinationPath $verifyDirectory
Get-ChildItem -LiteralPath $verifyDirectory
```

## 4. Verify the AWS Target

```powershell
aws sts get-caller-identity --profile mcp-prod-02

aws lambda get-function-configuration `
  --function-name random-redirect-link-api `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "{Runtime:Runtime,Handler:Handler,Timeout:Timeout,State:State,LastUpdateStatus:LastUpdateStatus}"
```

Expected current configuration:

- Runtime: `nodejs24.x`
- Handler: `index.handler`
- Timeout: `3`
- State: `Active`

The only application environment variable is `TABLE_NAME`. Preserve its current
value. Do not overwrite the full environment-variable map without a backup.

## 5. Least-Privilege IAM

The execution role needs CloudWatch Logs permissions, normally through
`AWSLambdaBasicExecutionRole`, and only `dynamodb:GetItem` for link data:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dynamodb:GetItem",
      "Resource": "arn:aws:dynamodb:ap-southeast-1:ACCOUNT_ID:table/random-redirect-link"
    }
  ]
}
```

Replace `ACCOUNT_ID`. The public function does not need Scan, Query, write, GSI,
table-management, or wildcard DynamoDB permissions.

## 6. Back Up the Current Function

```powershell
$backupDirectory = Join-Path $PWD "lambda/api/backups"
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDirectory "random-redirect-link-api-$timestamp.zip"

$codeUrl = aws lambda get-function `
  --function-name random-redirect-link-api `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "Code.Location" `
  --output text

Invoke-WebRequest -Uri $codeUrl -OutFile $backupPath
Remove-Variable codeUrl
```

Backups are ignored by Git. Never print, share, or commit the temporary code URL.

## 7. Upload the Code

```powershell
aws lambda update-function-code `
  --function-name random-redirect-link-api `
  --zip-file "fileb://lambda/api/dist/random-redirect-link-api.zip" `
  --region ap-southeast-1 `
  --profile mcp-prod-02

aws lambda wait function-updated `
  --function-name random-redirect-link-api `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

Verify that the function returns to `State=Active` and
`LastUpdateStatus=Successful` before sending traffic.

## 8. Verify API Gateway

The public HTTP API requires both routes:

```text
GET  /{proxy+}
HEAD /{proxy+}
```

Check their integration targets:

```powershell
aws apigatewayv2 get-routes `
  --api-id fvdc52ex62 `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "Items[].{Route:RouteKey,Target:Target}" `
  --output table
```

The current `$default` stage auto-deploys route changes. A code-only Lambda
update does not require an API Gateway deployment.

## 9. Smoke Test

Choose existing records representing a fixed target, a random-subdomain target,
and a disabled link. Use `HEAD` so target content is never downloaded:

```powershell
$publicBaseUrl = "https://fvdc52ex62.execute-api.ap-southeast-1.amazonaws.com"

curl.exe --head --max-redirs 0 "$publicBaseUrl/<fixed-path>"
curl.exe --head --max-redirs 0 "$publicBaseUrl/<random-path>"
curl.exe --head --max-redirs 0 "$publicBaseUrl/<random-path>"
curl.exe --head --max-redirs 0 "$publicBaseUrl/<disabled-path>"
```

Confirm:

- fixed and random links return `301` or `302` with `Location`;
- repeated random requests produce different target subdomains;
- responses include `Cache-Control: no-store`;
- the disabled link returns `404`;
- `HEAD` has no response body.

Repeat against the custom short-link domain if CloudFront or DNS is in front of
the API, because an edge-cache policy can override origin behavior.

## 10. Logs, Monitoring, and Rollback

```powershell
aws logs tail "/aws/lambda/random-redirect-link-api" `
  --since 15m `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

Monitor Lambda `Errors`, `Throttles`, and duration near the configured timeout.
For a public endpoint, also configure API Gateway throttling and access logs with
an appropriate retention period.

To roll back, upload the backup ZIP from section 6 with
`aws lambda update-function-code` and wait for `function-updated`. Code rollback
does not revert IAM, environment variables, or API Gateway configuration.

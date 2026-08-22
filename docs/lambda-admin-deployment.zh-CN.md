# Admin Lambda 部署教程

本文用于部署项目中的模块化 `random-redirect-link-admin` Lambda 源码，并将
API Gateway 路由绑定到该函数。示例环境如下：

- AWS CLI Profile：`mcp-prod-02`
- Region：`ap-southeast-1`
- Lambda：`random-redirect-link-admin`
- HTTP API ID：`h2ocs5m4ra`
- DynamoDB 表：`random-redirect-link`
- GSI：`links-by-path`

执行命令前，请确认当前终端使用的是预期 AWS 账号。不要把管理员令牌写进
Git、命令记录或部署包。

## 1. 源码与部署包

Lambda 源码位于：

```text
lambda/admin/
├─ src/
│  ├─ index.mjs
│  ├─ config.mjs
│  ├─ cursor.mjs
│  ├─ dynamodb.mjs
│  ├─ errors.mjs
│  ├─ http.mjs
│  ├─ link-path.mjs
│  ├─ link-record.mjs
│  ├─ repository.mjs
│  ├─ validation.mjs
│  └─ handlers/
│     ├─ batch.mjs
│     └─ links.mjs
├─ scripts/package.ps1
├─ test/
└─ package.json
```

源码按职责拆分，构建时由 esbuild 合并成一个 `index.mjs`。默认部署包不包含
AWS SDK v3，而是使用 Node.js 24 Lambda Runtime 内置的 SDK。项目仍保留固定版本
的 SDK 依赖，用于本地测试以及可选的自包含构建。

Lambda Handler 继续使用：

```text
index.handler
```

## 2. 本地准备

需要：

- Node.js 24，或与 Lambda 运行时兼容的 Node.js 版本
- pnpm 11
- PowerShell 7
- AWS CLI v2

如果尚未启用 pnpm，可执行：

```powershell
corepack enable
corepack prepare pnpm@11.19.0 --activate
```

在项目根目录安装 Lambda 子项目依赖：

```powershell
pnpm --dir lambda/admin install --frozen-lockfile
```

## 3. 测试并生成 ZIP

执行：

```powershell
pnpm --dir lambda/admin package
```

该命令会依次：

1. 运行 Node.js 单元测试。
2. 使用 esbuild 合并项目模块，并将 `@aws-sdk/*` 保留为 Runtime 外部依赖。
3. 生成 Lambda ZIP。

输出文件：

```text
lambda/admin/dist/random-redirect-link-admin.zip
```

这是推荐的默认部署包，依赖 Node.js 24 Lambda Runtime 内置的 AWS SDK v3。

如果需要完全固定 SDK 版本，可以生成包含 SDK 的自包含部署包：

```powershell
pnpm --dir lambda/admin package:self-contained
```

输出文件：

```text
lambda/admin/dist/random-redirect-link-admin-self-contained.zip
```

自包含包适合需要严格锁定 SDK 版本的环境，但体积更大，并需要自行跟进 SDK
安全更新。除非明确需要固定版本，本教程后续命令均使用默认精简部署包。

ZIP 根目录中应直接包含 `index.mjs`，不能再嵌套一层 `dist` 或 `admin` 目录。
可以这样检查：

```powershell
$verifyDirectory = Join-Path $env:TEMP "random-redirect-link-admin-verify"
Expand-Archive `
  -LiteralPath "lambda/admin/dist/random-redirect-link-admin.zip" `
  -DestinationPath $verifyDirectory `
  -Force
Get-ChildItem -LiteralPath $verifyDirectory
```

## 4. 确认 AWS 身份与现有配置

```powershell
aws sts get-caller-identity --profile mcp-prod-02

aws lambda get-function-configuration `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "{Runtime:Runtime,Handler:Handler,Timeout:Timeout,State:State,LastUpdateStatus:LastUpdateStatus}"
```

期望配置：

- Runtime：`nodejs24.x`
- Handler：`index.handler`
- Timeout：`10`
- State：`Active`

环境变量应继续保留原值：

- `TABLE_NAME`
- `ADMIN_TOKEN`
- `LINKS_INDEX_NAME`

不要使用会覆盖整个 `Environment.Variables` 对象的命令，除非已经完整备份现有值。

## 5. 部署前备份

先下载当前 `$LATEST` 代码包，方便回滚：

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

备份目录已被 `.gitignore` 排除，不要提交 Lambda 下载地址、令牌或备份包。

## 6. 上传 Lambda 代码

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

如果 Timeout 还不是 10 秒，再执行：

```powershell
aws lambda update-function-configuration `
  --function-name random-redirect-link-admin `
  --timeout 10 `
  --region ap-southeast-1 `
  --profile mcp-prod-02

aws lambda wait function-updated `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

## 7. 绑定 API Gateway 路由

Admin HTTP API 需要以下路由：

```text
GET    /links
POST   /links
GET    /{path+}
PATCH  /{path+}
DELETE /{path+}
POST   /links/batch
```

先检查路由是否存在并且 `Target` 非空：

```powershell
aws apigatewayv2 get-routes `
  --api-id h2ocs5m4ra `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "Items[].{Route:RouteKey,Target:Target}" `
  --output table
```

如果 `PATCH /{path+}` 或 `POST /links/batch` 的 Target 为空：

1. 打开 AWS Console。
2. 进入 API Gateway。
3. 打开 HTTP API `h2ocs5m4ra`。
4. 进入 `Routes`。
5. 选择对应路由并点击 `Attach integration`。
6. 选择 Lambda `random-redirect-link-admin` 的 AWS Proxy integration。
7. 确认 Target 变成 `integrations/<integration-id>`。

当前 `$default` Stage 使用自动部署，绑定完成后不需要手动创建 Deployment。

## 8. 检查 Lambda 调用权限

绑定集成时，AWS Console 通常会自动添加 `lambda:InvokeFunction` 权限。可以执行：

```powershell
aws lambda get-policy `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

`PATCH /{path+}` 应由现有 `{path+}` 权限覆盖。批量路由如果没有对应权限，可添加：

```powershell
aws lambda add-permission `
  --function-name random-redirect-link-admin `
  --statement-id apigateway-admin-links-batch `
  --action lambda:InvokeFunction `
  --principal apigateway.amazonaws.com `
  --source-arn "arn:aws:execute-api:ap-southeast-1:613574620583:h2ocs5m4ra/*/POST/links/batch" `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

如果 Statement ID 已存在，不要重复添加；先检查现有 Policy。

## 9. 部署后冒烟测试

以下测试会创建一个临时短链、停用它、批量启用它，然后删除。确认目标地址允许用于测试。

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
    randomSubdomain = $true
    subdomainLength = 5
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
  -Body (@{
    action = "enable"
    paths = @($testPath)
  } | ConvertTo-Json -Compress)

$deleted = Invoke-RestMethod `
  -Method Delete `
  -Uri "$adminBaseUrl/links/$testPath" `
  -Headers $headers

$created, $disabled, $batchResult, $deleted
Remove-Variable adminToken, secureToken, headers
```

期望结果：

- 创建返回 HTTP 201。
- 停用结果的 `enabled` 为 `false`。
- 批量启用结果的 `failed` 为空。
- 删除结果的 `deleted` 为 `true`。

## 10. 查看日志

```powershell
aws logs tail "/aws/lambda/random-redirect-link-admin" `
  --since 15m `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

重点检查：

- `CONFIG_ERROR`：必需环境变量缺失。
- `LIST_INDEX_UNAVAILABLE`：GSI 名称或状态异常。
- `DYNAMODB_THROTTLED`：DynamoDB 暂时限流。
- API Gateway 返回错误但 Lambda 没有调用日志：路由 Target 或调用权限异常。

## 11. 回滚

如果部署后异常，使用第 5 步生成的备份 ZIP 回滚：

```powershell
aws lambda update-function-code `
  --function-name random-redirect-link-admin `
  --zip-file "fileb://lambda/admin/backups/<backup-file>.zip" `
  --region ap-southeast-1 `
  --profile mcp-prod-02

aws lambda wait function-updated `
  --function-name random-redirect-link-admin `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

代码回滚不会自动还原 API Gateway 路由或 Lambda 配置。如果本次同时修改了这些资源，
需要分别恢复。

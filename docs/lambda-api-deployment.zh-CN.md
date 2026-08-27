# 公共跳转 Lambda 部署教程

简体中文 | [English](lambda-api-deployment.en.md)

本文用于打包和部署公共跳转函数 `random-redirect-link-api`。示例环境如下：

- AWS CLI Profile：`mcp-prod-02`
- Region：`ap-southeast-1`
- Lambda：`random-redirect-link-api`
- HTTP API ID：`fvdc52ex62`
- DynamoDB 表：`random-redirect-link`

访客需要直接打开短链，因此公共函数按设计不要求身份认证。请把执行角色限制为只读，
并在 API 和账号层配置限流与监控。

## 1. 行为和打包方式

函数会：

1. 规范化请求路径；
2. 按 `path` 分区键读取 DynamoDB 记录；
3. 在记录不存在或 `enabled` 为 `false` 时返回 `404`；
4. 根据记录生成随机二级域名目标或使用固定 `targetUrl`；
5. 返回禁止缓存的 `301` 或 `302` 跳转。

`HEAD` 返回与 `GET` 相同的状态码和响应头，但响应体为空。Handler 保持：

```text
index.handler
```

推荐部署包将 `@aws-sdk/*` 保留为外部依赖，使用 Node.js 24 Lambda Runtime
自带的 AWS SDK v3。只有明确需要固定 SDK 版本时才使用自包含包。

## 2. 本地环境要求

- Node.js 24，或本地兼容版本
- pnpm 11
- PowerShell 7
- AWS CLI v2

安装依赖：

```powershell
pnpm --dir lambda/api install --frozen-lockfile
```

## 3. 测试并生成 ZIP

```powershell
pnpm --dir lambda/api package
```

该命令会运行单元测试、生成单个 ESM bundle，并输出：

```text
lambda/api/dist/random-redirect-link-api.zip
```

ZIP 根目录必须直接包含 `index.mjs`，不能再嵌套 `dist` 或 `api` 目录。
可选自包含包的命令为：

```powershell
pnpm --dir lambda/api package:self-contained
```

检查默认 ZIP：

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

## 4. 确认 AWS 目标

```powershell
aws sts get-caller-identity --profile mcp-prod-02

aws lambda get-function-configuration `
  --function-name random-redirect-link-api `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "{Runtime:Runtime,Handler:Handler,Timeout:Timeout,State:State,LastUpdateStatus:LastUpdateStatus}"
```

当前期望配置：

- Runtime：`nodejs24.x`
- Handler：`index.handler`
- Timeout：`3`
- State：`Active`

应用环境变量只有 `TABLE_NAME`，请保留其现有值。没有完整备份前，不要覆盖整个
环境变量对象。

## 5. 最小权限 IAM

执行角色需要 CloudWatch Logs 权限，通常通过 `AWSLambdaBasicExecutionRole`
提供；短链数据只需要 `dynamodb:GetItem`：

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

请替换 `ACCOUNT_ID`。公共函数不需要 Scan、Query、写入、GSI、表管理或 DynamoDB
通配权限。

## 6. 备份当前函数

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

备份目录已被 Git 忽略。不要打印、分享或提交临时代码下载地址。

## 7. 上传代码

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

发送测试流量前，确认函数恢复为 `State=Active` 且
`LastUpdateStatus=Successful`。

## 8. 检查 API Gateway

公共 HTTP API 必须包含：

```text
GET  /{proxy+}
HEAD /{proxy+}
```

检查两个路由是否都已绑定集成：

```powershell
aws apigatewayv2 get-routes `
  --api-id fvdc52ex62 `
  --region ap-southeast-1 `
  --profile mcp-prod-02 `
  --query "Items[].{Route:RouteKey,Target:Target}" `
  --output table
```

当前 `$default` Stage 会自动部署路由变更。仅更新 Lambda 代码不需要创建新的
API Gateway Deployment。

## 9. 冒烟测试

选择已有的固定目标、随机二级域名和停用记录。使用 `HEAD`，避免下载目标内容：

```powershell
$publicBaseUrl = "https://fvdc52ex62.execute-api.ap-southeast-1.amazonaws.com"

curl.exe --head --max-redirs 0 "$publicBaseUrl/<固定短链路径>"
curl.exe --head --max-redirs 0 "$publicBaseUrl/<随机短链路径>"
curl.exe --head --max-redirs 0 "$publicBaseUrl/<随机短链路径>"
curl.exe --head --max-redirs 0 "$publicBaseUrl/<已停用短链路径>"
```

确认：

- 固定和随机短链返回 `301` 或 `302`，并包含 `Location`；
- 两次随机请求生成不同的目标子域名；
- 响应包含 `Cache-Control: no-store`；
- 已停用短链返回 `404`；
- `HEAD` 没有响应体。

如果自定义短链域名前还有 CloudFront 或其他 CDN，也要针对自定义域名重复测试，
因为边缘缓存策略可能覆盖源站行为。

## 10. 日志、监控和回滚

```powershell
aws logs tail "/aws/lambda/random-redirect-link-api" `
  --since 15m `
  --region ap-southeast-1 `
  --profile mcp-prod-02
```

至少监控 Lambda 的 `Errors`、`Throttles`，以及接近 Timeout 的执行时间。对于公共
入口，还应配置 API Gateway 限流和有明确保留时间的访问日志。

需要回滚时，用 `aws lambda update-function-code` 上传第 6 节备份的 ZIP，并再次
等待 `function-updated`。代码回滚不会恢复 IAM、环境变量或 API Gateway 配置。

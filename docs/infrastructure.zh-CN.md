# AWS SAM 基础设施

项目根目录的 `template.yaml` 定义了后端基础设施：

- 一个 DynamoDB 表及 `links-by-path` 全局二级索引；
- 相互独立的 Admin HTTP API 和公开跳转 HTTP API；
- 分别用于管理与公开跳转的 Lambda 函数；
- 由 AWS Secrets Manager 生成并保存的 Admin Bearer Token；
- API 访问日志、Lambda 日志保留期、链路追踪、限流和最小权限 IAM。

## 部署前须知

模板会创建新资源，不会自动接管现有的表、API、函数或密钥。已有环境应将受支持的资源导入 CloudFormation，或部署一套并行环境，再有计划地迁移数据和流量。

DynamoDB 表和 Admin Token 密钥均配置了 `DeletionPolicy: Retain` 与 `UpdateReplacePolicy: Retain`。删除栈时会保留这两个有状态资源，便于恢复或后续人工清理。

## 验证与构建

安装 AWS SAM CLI、`cfn-lint` 和 `cfn-guard` 后运行：

```powershell
sam validate --lint
cfn-lint template.yaml
sam build
```

生产部署前，还应使用组织内的 `cfn-guard` 规则检查 `template.yaml`。

## 部署

首次交互式部署可运行：

```powershell
sam deploy --guided
```

每个环境使用独立的栈和参数配置，至少检查 `Environment`、日志保留期，以及两个 API 的持续和突发限流值。

部署后，将输出的 `AdminApiBaseUrl` 和 `PublicApiBaseUrl` 写入 `API_TARGETS`。仅通过已授权的 Secrets Manager 客户端读取生成的 Admin Token，并作为 `adminToken` 提供；不要将 Token 提交到仓库。

## 生产检查清单

- 确认两个 API URL 均使用 HTTPS。
- 限制生成密钥的访问权限；在 Secrets Manager 中轮换后，重新部署 Admin 函数配置以解析新值。
- 检查 CloudWatch API 访问日志、函数日志、告警和保留期。
- 测试创建、列表、更新、批量、删除、GET 跳转和 HEAD 跳转。
- 迁移数据或流量前，备份或导出现有 DynamoDB 表。

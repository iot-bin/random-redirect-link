# AWS SAM 基础设施

简体中文 | [English](infrastructure.en.md)

## 栈结构

- `template.yaml`：短链后端，包含保留的 DynamoDB 短链表、`links-by-path` GSI、`purgeAt` TTL、Admin 与公共 HTTP API，以及两个 Node.js 24 Lambda。
- `infrastructure/control.yaml`：Cognito 用户池与客户端、保留的配置表和审计表、管理 HTTP API 与 Control Lambda。
- `infrastructure/artifacts.yaml`：可选的私有、加密、启用版本控制的部署产物 S3 存储桶。

Admin 路由使用 `AWS_IAM`。Control Lambda 校验成员与环境权限后，以自身 IAM 角色签名调用后端。公共跳转无需登录。控制台通过服务端变量 `MANAGEMENT_API_URL` 连接管理服务。

模板创建资源，不会自动接管手动管理的资源。删除栈后，保留的表、用户池和产物桶需要单独清理。

## 验证与构建

先安装三个 Lambda 子项目的依赖。使用独立的 SAM 构建目录和配置文件，避免部署错误的栈。

```powershell
cfn-lint template.yaml infrastructure/control.yaml infrastructure/artifacts.yaml
sam validate --lint --template-file template.yaml
sam validate --lint --template-file infrastructure/control.yaml
sam build --template-file template.yaml --build-dir .aws-sam/backend
sam build --template-file infrastructure/control.yaml --build-dir .aws-sam/control
```

生产部署前执行组织的 CloudFormation Guard 规则。

## 参数与部署

已有短链后端时，使用核实后的 Admin API ID 设置管理栈的 `BackendApiIds`，并在 `BackendInvokeArns` 中设置相同 API 的精确 execute-api ARN。输出的 `ManagementRoleArn` 必须与 Admin Lambda 的 `MANAGEMENT_ROLE_ARN` 一致。

全新安装时，两个模板存在资源准备依赖：后端需要管理角色 ARN，管理栈需要后端 API ID。部署前需安排资源创建和参数更新顺序；当前模板不提供一条命令完成的组合初始化流程。资源准备期间始终保持 Admin API 的 IAM 认证。

逐个后端栈核对 `Environment`、`ManagementRoleArn`、`LinksIndexName`、日志保留期与限流参数。管理栈还需核对 `WorkspaceId` 和后端允许列表。

显式指定要部署的构建模板：

```powershell
sam deploy --guided --template-file .aws-sam/backend/template.yaml --config-file samconfig.backend.toml
sam deploy --guided --template-file .aws-sam/control/template.yaml --config-file samconfig.control.toml
```

这是两个独立的栈操作，按当前部署需要执行相应命令。

根据后端输出填写工作空间环境的 `apiId`、`stage` 与 `redirectBaseUrl`。SAM 后端 URL 包含 `Environment` stage。按[管理中心部署](control-plane.zh-CN.md)初始化所有者和工作空间，再将 `ManagementApiUrl` 输出填入 `MANAGEMENT_API_URL`。

## 验证与运维

- 确认所有 Admin 路由启用 IAM、集成使用 PayloadFormatVersion 2.0，且仅接受指定管理角色。
- 验证 Cognito 登录、成员授权、创建、列表、修改、批量操作、删除、恢复及公共 GET/HEAD 跳转。
- 核对 `purgeAt` TTL、PITR、日志保留、限流与监控。
- 更新前备份代码包与配置；回滚使用兼容 IAM 认证的版本。
- 部署记录和凭据保存在 Git 外。

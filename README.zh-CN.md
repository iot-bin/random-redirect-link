# 随机跳转短链控制台

> db-rebuild：部署前必须阅读 [管理中心迁移说明](docs/control-plane.zh-CN.md)。旧 Token 部署教程仅供历史参考，不能直接用于本分支。

简体中文 | [English](README.md)

这是一个 Next.js 短链管理控制台，同时保存配套 AWS Lambda 的可版本管理源码。
控制台支持创建、查询、编辑、启用、停用和删除跳转短链，并提供简体中文、繁体中文
和英文界面。

## 面板预览

以下截图来自本地演示环境，使用 `example.com` 示例地址，不包含生产数据。

![链接管理：状态、路径筛选与分页](docs/images/zh-CN/console-links.png)

[查看完整面板图集](docs/console-preview.zh-CN.md)：创建短链、详情抽屉、回收站、设置、深色模式和移动端。

## 架构

```text
浏览器
  -> Next.js 控制台服务端路由
  -> Admin HTTP API
  -> random-redirect-link-admin Lambda
  -> DynamoDB

访客打开短链
  -> Public HTTP API
  -> random-redirect-link-api Lambda
  -> DynamoDB
  -> HTTP 301 或 302 跳转
```

浏览器和 Next.js 不再持有 Admin Token。Next.js 只转发用户访问令牌，管理服务验证环境权限后使用 IAM 签名调用 Admin API。

## 功能

- 创建随机二级域名或固定目标地址短链。
- 按游标分页浏览短链，并按路径前缀筛选。
- 查看、编辑、启用、停用和删除单条短链。
- 每次批量启用、停用、移入回收站或恢复最多 50 条短链。
- 设置生效和过期时间；删除后保留 7 天，可在保留期内恢复。
- 使用详情抽屉、短链复制和二维码，支持深浅主题与移动端布局。
- 在浏览器中保存默认环境、界面语言、主题和每页数量。
- 在 `zh-CN`、`zh-TW` 和 `en` 之间切换界面语言。
- 配置并切换多个相互独立的 API 环境。
- 默认构建使用 Lambda Runtime 内置 AWS SDK v3 的精简包，也可生成包含固定 SDK
  版本的自包含包。

## 项目结构

```text
app/                 Next.js App Router 页面和服务端路由
lib/                 API 环境、校验、会话和 i18n 模块
lambda/admin/        Admin Lambda 源码、测试和打包脚本
lambda/api/          公共跳转 Lambda 源码、测试和打包脚本
docs/                英文和简体中文部署教程
public/              静态资源，包括项目 favicon
```

## 环境要求

- 与 Next.js 16 兼容的 Node.js
- 根目录 Next.js 项目使用 npm
- Lambda 子项目使用 Node.js 24 和 pnpm 11
- ZIP 打包脚本需要 PowerShell 7

## 控制台配置

本分支使用 Cognito、DynamoDB 管理中心和 IAM 后端认证，不再读取
`CONSOLE_PASSWORD`、`API_TARGETS`、`DEFAULT_TARGET_ID`、`SITE_TITLE` 或 `SITE_DESCRIPTION`。

先按 [管理中心部署与迁移](docs/control-plane.zh-CN.md) 创建独立管理栈、初始化所有者和环境配置，
再填写 `config/bootstrap.local.json` 中的区域、管理 API URL 和 Cognito Client ID。
这三个值都是非敏感启动坐标，可提交到仓库；文件留空时应用拒绝登录。

环境、站点标题和成员权限在管理中心编辑，无需重新部署前端。
默认环境和分页数量按用户保存在数据库；语言和主题继续保存在浏览器。
原登录页保留样式，改用邮箱、密码、首次登录改密、找回密码和可选验证器 MFA。

## 本地开发

```powershell
npm install
npm run dev
```

初始化管理栈与 bootstrap 配置后，打开 `http://localhost:3000`，使用受邀的 Cognito 账号登录。

常用检查命令：

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## Lambda 源码

| 函数 | 源码目录 | Handler | 必需环境变量 |
|---|---|---|---|
| `random-redirect-link-admin` | `lambda/admin` | `index.handler` | `TABLE_NAME`、`MANAGEMENT_ROLE_ARN`；`LINKS_INDEX_NAME` 可选 |
| `random-redirect-link-api` | `lambda/api` | `index.handler` | `TABLE_NAME` |

生成推荐的精简部署包：

```powershell
pnpm --dir lambda/admin install --frozen-lockfile
pnpm --dir lambda/admin package
pnpm --dir lambda/api install --frozen-lockfile
pnpm --dir lambda/api package
```

默认包会将 `@aws-sdk/*` 保留为外部依赖，使用 Node.js 24 Lambda Runtime 自带的
AWS SDK v3。需要固定并包含 SDK 版本时，在对应 Lambda 目录执行
`package:self-contained`。

## 部署教程

- 完整 AWS SAM 基础设施：[English](docs/infrastructure.en.md) |
  [简体中文](docs/infrastructure.zh-CN.md)
- Admin Lambda：[English](docs/lambda-admin-deployment.en.md) |
  [简体中文](docs/lambda-admin-deployment.zh-CN.md)
- 公共跳转 Lambda：[English](docs/lambda-api-deployment.en.md) |
  [简体中文](docs/lambda-api-deployment.zh-CN.md)

教程包括打包、最小权限 IAM、API Gateway 路由、备份、冒烟测试、日志和回滚。
生成部署包本身不会部署到 AWS。

## 安全和运维建议

- 使用独立 Cognito 账号并启用 TOTP MFA，按需分配环境权限。
- 管理调用使用 Lambda IAM 角色，无需共享密码或 Admin Token。不要提交会话令牌、
  下载的 Lambda 包或备份。
- 公共跳转 API 按设计无需认证，应配置 API Gateway 限流并监控 Lambda 错误、限流
  和执行时间。
- 公共 Lambda 的角色只授予短链表的 `dynamodb:GetItem`；Admin Lambda 只授予表和
  列表索引所需操作。
- 部署备份应放在 Git 之外，并在每次更新代码前后核对函数状态。

## 回收站与有效期

新增可选 startsAt/expiresAt，使用带时区的 ISO 8601 时间；PATCH 中 null 表示清除，省略表示不修改。界面统一显示新加坡时间 UTC+8。GET/HEAD 每次实时检查删除标记、启停状态和时间，旧记录保持兼容。

单条及批量删除改为保留 7 天的软删除，重复删除不延长保留期。GET /links?view=trash 查看回收站；默认 view=links 排除已删除记录。PATCH /links/{path} 传 restore:true 恢复，可同时修改有效期；批量 action=restore 最多 50 条。恢复保留原启停状态，已过期时必须延长或清除过期时间。保留期截止即禁止恢复或续期；物理清理前路径仍被占用。

TTL 字段为数值型 Unix 秒 purgeAt，不能直接使用 expiresAt。正常到期后保留 7 天再进入清理范围，手动删除则从删除时起保留 7 天。TTL 异步清理，不保证准点删除。列表过滤保留分页游标，GSI 列表可能短暂延迟；直接读取使用强一致性，更新使用版本条件避免并发覆盖。

上线顺序：先部署跳转 Lambda 的实时检查，再部署管理 Lambda 和控制台，验证后最后启用 purgeAt TTL。SAM 模板已声明该字段；现有手动管理资源需单独核对并配置 TTL，涉及换表时应按迁移方案备份、校验和切换。恢复复用 PATCH 和批量路由，不需要新 API Gateway 路由。

## 参与贡献与安全报告

- 本地开发、验证命令和 Pull Request 要求请参阅
  [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全漏洞请按照 [SECURITY.md](SECURITY.md) 进行私下报告，不要在公开 Issue 中披露。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。

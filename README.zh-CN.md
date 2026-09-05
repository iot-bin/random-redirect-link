# 随机跳转短链控制台

简体中文 | [English](README.md)

这是一个 Next.js 短链管理控制台，同时保存配套 AWS Lambda 的可版本管理源码。
控制台支持创建、查询、编辑、启用、停用和删除跳转短链，并提供简体中文、繁体中文
和英文界面。

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

浏览器不会拿到 Admin API 令牌。Next.js 会在服务端解析所选环境，附加 Bearer
令牌后再转发请求。

## 功能

- 创建随机二级域名或固定目标地址短链。
- 按游标分页浏览短链，并按路径前缀筛选。
- 查看、编辑、启用、停用和删除单条短链。
- 每次批量启用、停用或删除最多 50 条短链。
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

将 `.env.example` 复制为 `.env.local`，然后配置：

```env
CONSOLE_PASSWORD=请替换为高强度密码
SITE_TITLE=短链管理控制台
SITE_DESCRIPTION=创建、查询和管理跳转短链
API_TARGETS=[{"id":"prod","name":"生产环境","apiBaseUrl":"https://admin-api.example.com","adminToken":"请替换为管理令牌","redirectBaseUrl":"https://go.example.com"}]
DEFAULT_TARGET_ID=prod
```

| 变量 | 必需 | 用途 |
|---|---:|---|
| `CONSOLE_PASSWORD` | 是 | 登录密码，同时用于签名控制台会话。 |
| `API_TARGETS` | 是 | Admin API 环境的 JSON 数组。 |
| `DEFAULT_TARGET_ID` | 否 | 初始选中的环境；未设置时使用第一个有效环境。 |
| `SITE_TITLE` | 否 | 浏览器标题和控制台品牌名称。 |
| `SITE_DESCRIPTION` | 否 | 页面元数据描述。 |

每个 `API_TARGETS` 项目都需要：

- `id`：稳定且唯一的标识符。
- `name`：控制台显示名称。
- `apiBaseUrl`：必须使用 HTTPS 的 Admin API 基础地址。
- `adminToken`：与 Admin Lambda 匹配的 Bearer 令牌，只在服务端使用。
- `redirectBaseUrl`：控制台显示的公共短链域名。

不要给 `adminToken` 或其他秘密使用 `NEXT_PUBLIC_` 前缀。

## 本地开发

```powershell
npm install
npm run dev
```

打开 `http://localhost:3000`，使用 `CONSOLE_PASSWORD` 登录。

常用检查命令：

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## Lambda 源码

| 函数 | 源码目录 | Handler | 必需环境变量 |
|---|---|---|---|
| `random-redirect-link-admin` | `lambda/admin` | `index.handler` | `TABLE_NAME`、`ADMIN_TOKEN`；`LINKS_INDEX_NAME` 可选 |
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

- 为 `CONSOLE_PASSWORD` 和 Admin Token 分别使用高强度值。
- 生产秘密只保存在托管平台和 Lambda 配置中，不要提交 `.env.local`、令牌、下载的
  Lambda 包或备份。
- 公共跳转 API 按设计无需认证，应配置 API Gateway 限流并监控 Lambda 错误、限流
  和执行时间。
- 公共 Lambda 的角色只授予短链表的 `dynamodb:GetItem`；Admin Lambda 只授予表和
  列表索引所需操作。
- 部署备份应放在 Git 之外，并在每次更新代码前后核对函数状态。

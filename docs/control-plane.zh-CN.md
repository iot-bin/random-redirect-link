# db-rebuild 管理中心

本分支的目标架构是 Cognito + DynamoDB + 管理 Lambda + IAM，不使用 Secrets Manager。
代码变更不等于已经部署。`config/bootstrap.local.json` 留空时，登录会明确报未配置。

## 部署记录

仓库仅保留空的 `config/bootstrap.json` 默认值和虚构的工作空间示例。复制默认文件为已忽略的 `config/bootstrap.local.json`，在本地填写；真实工作空间输入使用已忽略的 `config/workspace.local.json`。修改后重启应用，初始化脚本也只生成本地 bootstrap 文件。

部署时，通过私有构建流程在构建前提供本地 bootstrap 文件，Next.js 会将其包含在服务端部署产物中。不要公开构建产物或把该文件放入 `public/`。仅从 Git 构建且未提供本地配置时，登录会明确报未配置；这个配置机制不要求平台环境变量或长期凭据。

实际账号、资源名称、服务地址、管理员信息和测试结果保存在 Git 外的私有运维记录中。生产迁移前应先部署隔离测试资源；带 Retain 的资源需要单独清理。

## 请求与信任边界

浏览器仍使用 Next.js 同源 `/api` 路由。邮箱和密码通过 HTTPS 提交至登录路由，
由它调用 Cognito 的公开客户端 API，不需要 AWS 访问密钥。用户访问令牌与刷新令牌
仅存于 HttpOnly、Secure（生产）、SameSite=Strict Cookie，前端脚本不可读取。
所有同源写请求检查 Origin。Proxy 只作导航检查，不被当作最终授权边界。

管理 API Gateway 验证 Cognito JWT 与 scope。管理 Lambda 再验证 access-token 类型、
客户端、发行者、有效期及会话撤销，并实时读取 Cognito 启用状态和 DynamoDB 成员权限。
编辑者仅可写获授权环境；只读成员不可创建、修改、删除或批量操作。
不接受客户端提供的任意后端 URL。配置只能选择部署参数允许的 API ID；
管理角色的 execute-api 权限也限制到这些 API。签名请求禁止跟随重定向。

Admin Lambda 校验 API Gateway 提供的 IAM caller 与 MANAGEMENT_ROLE_ARN 对应角色。
直接 Lambda Invoke 权限必须仅授予受信任运维身份；能直接调用 Lambda 的身份可以构造事件，
因此不能给普通用户或前端授予 lambda:InvokeFunction。

## 存储

每个管理栈对应一个工作空间。工作空间 ID 是部署参数，不能由请求选择；未来多工作空间
可以扩展，当前不是跨工作空间 SaaS 实现。

配置表使用 `pk=WS#<workspace>`，`sk` 分别为：

- `CONFIG`：环境列表、站点标题描述、默认环境、version。
- `OWNER`：不可通过管理页面更改的所有者 Cognito sub。
- `MEMBER#<sub>`：角色、active、环境 grants、version。
- `PREF#<sub>`：默认环境和分页数量。语言及主题仍为浏览器偏好。
- `SESSION#<origin_jti>`：注销令牌族的撤销记录，purgeAt TTL 保留八天。

审计独立一张表。写操作先记录 attempt，再调用后端，最后记录 result/error。
如果结果记录失败，调用方收到 503，不能认定业务未执行；应重新查询数据再决定是否重试。
审计不保存密码、访问令牌或完整请求正文。页面展示最近 100 条，当前不提供长期归档和导出。
两张表都按需计费、启用 PITR，并使用 Retain。审计表不会自动清理，需按业务制定保留策略。

## 本地检查

```powershell
pnpm --dir lambda/control install --frozen-lockfile
pnpm --dir lambda/control test
pnpm --dir lambda/control build
node --test lambda/admin/test/*.test.mjs lambda/api/test/*.test.mjs
npx tsc --noEmit --incremental false
npm run lint
npm run build
cfn-lint infrastructure/control.yaml template.yaml
```

管理包包含其 SDK 依赖，避免依赖 Lambda Runtime 中未保证存在的额外 SDK 包。
根目录仍使用 npm 和 package-lock，Lambda 子项目使用 pnpm。

## 部署准备

1. 确认账号 your-aws-profile 与 ap-southeast-1，并重新核对所需 Admin API、函数、路由、
   stage、PayloadFormatVersion=2.0、现有 Lambda resource policy 和表绑定。
2. `config/workspace.example.json` 是待复核的初始配置，域名必须以现网核对结果为准。
3. `infrastructure/control.yaml` 只新建管理资源；根 `template.yaml` 是新建短链后端模板，
   不要拿它去直接接管已有生产资源。
4. `BackendApiIds` 填入允许使用的管理 API IDs。`BackendInvokeArns` 为相同 API 的
   `arn:aws:execute-api:ap-southeast-1:<account>:<api-id>/*/*/links*` 列表，不使用全账号通配。
5. 部署管理栈，例如 `sam build --template-file infrastructure/control.yaml` 后
   `sam deploy --guided`。确认实际 build 输出模板对应管理栈。
6. 在新 Cognito User Pool 创建首个管理员，邮箱由用户指定。创建会发送临时密码邮件，
   不在代码、终端输出或文档保存密码。Cognito 默认邮件有发送配额，扩大使用前配置 SES。
7. 导出管理栈非敏感 Outputs 为 JSON，然后运行：

```powershell
node lambda/control/scripts/initialize.mjs stack-outputs.json config/workspace.example.json <owner-email> main
```

初始化脚本只查询已存在的用户，使用一次 DynamoDB 事务创建 CONFIG/OWNER/MEMBER，
不会覆盖已有记录，也不会创建用户或发邮件。它生成仅本地使用的 `config/bootstrap.local.json`。
使用本地 AWS 标准凭据链，执行前明确选择 AWS_PROFILE=your-aws-profile、AWS_REGION=ap-southeast-1。
若事务成功后写本地配置失败，手动从 Outputs 填写 bootstrap，不要删除已创建的数据重跑。

## 安全切换顺序

先使用隔离测试环境验证完整登录、首次改密、找回密码、MFA、退出、角色与批量操作。
生产切换前备份现有 Lambda 包、环境配置、API 路由/集成和旧前端部署，保存在 Git 外。

逐个环境切换：先将所有管理路由设为 AWS_IAM（包括可能存在的 $default/ANY），
再发布新的 Admin handler 并设置 MANAGEMENT_ROLE_ARN。保留 TABLE_NAME、索引、
WRITE_DISABLED 等其他值。这段短暂窗口管理操作可能不可用，公开跳转不受影响。
原 Token handler 不能接受 IAM 签名请求，这是有意采用的关闭式过渡，不设置匿名过渡入口。

验证未签名、旧 Bearer、错误角色都被拒绝；正确管理角色可读写，Public API 仍可跳转。
检查每个 API 的所有 routes、integrations 和 Lambda 调用入口，不能遗留绕过路径。
完成后移除 ADMIN_TOKEN 并发布已填写 bootstrap 的前端。最后清理 Vercel 的旧业务环境变量。

回滚时先保持路由 AWS_IAM，再恢复旧函数包与旧令牌配置；确认 handler 已恢复 Token 校验后，
才恢复原 API 路由认证设置及旧前端部署。禁止先移除 API 认证再恢复旧 handler。
如果新环境已经接受写入，不做数据回滚；本方案不搬迁或复制短链表。

## 变量去向

删除 Vercel 的 CONSOLE_PASSWORD/API_TARGETS/DEFAULT_TARGET_ID/SITE_TITLE/SITE_DESCRIPTION。
删除 Admin Lambda 的 ADMIN_TOKEN。PUBLIC API 与原表绑定不变。
保留 Lambda TABLE_NAME/LINKS_INDEX_NAME/WRITE_DISABLED，并新增非敏感 MANAGEMENT_ROLE_ARN。
管理 Lambda 的表名、User Pool ID、Client ID、工作空间和 API allowlist 由 SAM 注入。
Vercel 不保存长期后台密钥；用户会话令牌仍会短暂经过 Next.js 运行环境。

## 第一版范围

具备邀请、成员启停、环境读写权限、配置版本冲突、所有者保护、站点与环境编辑、
个人默认环境/分页、密码恢复和 TOTP 设置。邀请失败可能留下 Cognito 用户但未写入成员，
可通过 Cognito 查询 sub 后使用成员 PUT 接口补录。第一版不支持 SSO、自助注册、
强制 MFA_SETUP 挑战、多工作空间切换和审计导出。
不要把 User Pool MFA 改为必选，除非先实现首次登录的 MFA_SETUP 流程。

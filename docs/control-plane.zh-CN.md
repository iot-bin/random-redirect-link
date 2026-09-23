# 管理中心部署

管理中心使用 Cognito、DynamoDB、管理 Lambda 和 IAM。
代码变更不等于已经部署。`MANAGEMENT_API_URL` 未设置时，登录会明确报未配置。

## 部署记录

在 Vercel 对应环境中设置服务端变量 `MANAGEMENT_API_URL`，值取管理栈输出 `ManagementApiUrl`。本地开发复制 `.env.example` 为已忽略的 `.env.local` 并填写该值。真实工作空间输入继续使用已忽略的 `config/workspace.local.json`。

`/public/site` 只公开站点标题、描述、Region 和 Cognito Client ID。Next.js 按运行实例缓存有效结果 60 秒，并合并并发请求；失败不缓存、过期结果不回退使用。环境、权限和会话请求仍不缓存。这个 HTTPS 入口决定认证配置来源，只能由部署者设置，不能接受浏览器请求提供的地址。

先部署管理 Lambda，再填写 Vercel 变量并从 Git 部署前端。无需本地 bootstrap JSON、文件追踪配置或预构建上传。修改变量后本地重启、Vercel 重新部署。

实际账号、资源名称、服务地址、管理员信息和测试结果保存在 Git 外的私有运维记录中。生产部署前应先部署隔离测试资源；带 Retain 的资源需要单独清理。

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
两张表都按需计费、启用 PITR，并使用 Retain。新审计记录按 `AuditRetentionDays`
保留，默认 30 天；API 到期后立即隐藏，DynamoDB TTL 会异步清理。原有未设置
`purgeAt` 的记录到期后也会从查询结果中隐藏；物理清理需要一次性回填。
部署审计表 TTL 后，设置 `AUDIT_TABLE`、`WORKSPACE_ID`、`AWS_REGION`
及可选的 `AUDIT_RETENTION_DAYS`，先运行
`node lambda/control/scripts/backfill-audit-ttl.mjs` 预览数量，再加 `--apply`
为旧记录写入或按新的保留期限重新计算到期时间。PITR 备份仍可能在其恢复窗口内保留已删除的数据。
Control Lambda 启用 X-Ray 主动追踪。CloudWatch 告警及通知目标由部署者自行配置。

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
2. 将 `config/workspace.example.json` 复制为已忽略的 `config/workspace.local.json`，填写已核对的 API ID、stage 和短链域名。
3. `infrastructure/control.yaml` 只新建管理资源；根 `template.yaml` 是新建短链后端模板，
   不要拿它去直接接管已有生产资源。
4. `BackendApiIds` 填入允许使用的管理 API IDs。`BackendInvokeArns` 为相同 API 的
   `arn:aws:execute-api:ap-southeast-1:<account>:<api-id>/*/*/links*` 列表，不使用全账号通配。
5. 部署管理栈，例如 `sam build --template-file infrastructure/control.yaml --build-dir .aws-sam/control` 后
   `sam deploy --guided --template-file .aws-sam/control/template.yaml --config-file samconfig.control.toml`。确认实际 build 输出模板对应管理栈。
6. 在新 Cognito User Pool 创建首个管理员，邮箱由用户指定。创建会发送临时密码邮件，
   不在代码、终端输出或文档保存密码。Cognito 默认邮件有发送配额，扩大使用前配置 SES。
7. 导出管理栈非敏感 Outputs 为 JSON，然后运行：

```powershell
node lambda/control/scripts/initialize.mjs stack-outputs.json config/workspace.local.json <owner-email> main
```

初始化脚本只查询已存在的用户，使用一次 DynamoDB 事务创建 CONFIG/OWNER/MEMBER，
不会覆盖已有记录，也不会创建用户、发邮件或生成前端配置文件。
使用本地 AWS 标准凭据链，执行前明确选择 AWS_PROFILE=your-aws-profile、AWS_REGION=ap-southeast-1。
初始化完成后，从 Outputs 取得 ManagementApiUrl 并设置 MANAGEMENT_API_URL。

## 验收与回滚

在隔离测试环境验证登录、首次改密、找回密码、TOTP、退出、角色、跨环境权限和批量操作。
所有 Admin 路由必须使用 `AWS_IAM`，集成使用 PayloadFormatVersion 2.0，Handler 仅接受指定管理角色。
验证未签名及其他角色调用被拒绝，公共跳转正常。

更新前将函数包、环境配置、API 路由/集成和前端部署备份保存在 Git 外。
回滚使用兼容 Cognito/IAM 的版本，并保持路由认证和角色校验。代码回滚不会恢复数据或配置；
重试操作前应结合审计结果核对已执行的写入。

## 部署变量

Admin Lambda 使用 `TABLE_NAME`、`MANAGEMENT_ROLE_ARN`，可选 `LINKS_INDEX_NAME`、`WRITE_DISABLED`。
公共 Lambda 使用 `TABLE_NAME`。管理 Lambda 的表名、User Pool ID、Client ID、工作空间和 API allowlist 由 SAM 注入。
Vercel 仅设置服务端 `MANAGEMENT_API_URL`；用户会话令牌通过 Next.js 转发至管理服务。

## 功能与限制

具备邀请、成员启停、环境读写权限、配置版本冲突、所有者保护、站点与环境编辑、
个人默认环境/分页、密码恢复和 TOTP 设置。邀请失败可能留下 Cognito 用户但未写入成员，
可通过 Cognito 查询 sub 后使用成员 PUT 接口补录。当前不支持 SSO、自助注册、
强制 MFA_SETUP 挑战、多工作空间切换和审计导出。
不要把 User Pool MFA 改为必选，除非先实现首次登录的 MFA_SETUP 流程。

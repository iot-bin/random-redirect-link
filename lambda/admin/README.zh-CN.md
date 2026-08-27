# random-redirect-link-admin Lambda

简体中文 | [English](README.md)

本目录保存 `random-redirect-link-admin` Lambda 的可版本管理源码。

源码按职责拆分在 `src/` 下，生产构建会合并为单个 `index.mjs`，Handler 保持
`index.handler`。默认部署包使用 Node.js 24 Lambda Runtime 自带的 AWS SDK v3。

`POST /links` 未提供 `randomSubdomain` 时默认按 `true` 处理。显式传入 `false`
会创建固定目标地址短链，此时不要求也不会保存 `subdomainLength`。

## 命令

从仓库根目录执行：

```powershell
pnpm --dir lambda/admin install --frozen-lockfile
pnpm --dir lambda/admin test
pnpm --dir lambda/admin package
```

推荐的精简部署包输出到：

```text
lambda/admin/dist/random-redirect-link-admin.zip
```

如果必须固定并包含 AWS SDK v3 版本，可执行：

```powershell
pnpm --dir lambda/admin package:self-contained
```

自包含包输出到
`lambda/admin/dist/random-redirect-link-admin-self-contained.zip`。

AWS 配置、最小权限 IAM、API Gateway 集成、冒烟测试和回滚步骤请参阅
[简体中文部署教程](../../docs/lambda-admin-deployment.zh-CN.md)或
[English deployment guide](../../docs/lambda-admin-deployment.en.md)。

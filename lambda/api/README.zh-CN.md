# random-redirect-link-api Lambda

简体中文 | [English](README.md)

本目录保存公共跳转函数 `random-redirect-link-api` 的可版本管理源码。

函数按 `path` 主键读取短链记录；记录不存在或已停用时返回 `404`，有效记录返回
禁止缓存的 `301` 或 `302` 跳转。它同时支持随机二级域名记录和固定 `targetUrl`
记录。`HEAD` 与 `GET` 返回相同状态码和响应头，但响应体为空。

源码按职责拆分在 `src/` 下，生产构建会合并为单个 `index.mjs`，Handler 保持
`index.handler`。默认部署包使用 Node.js 24 Lambda Runtime 自带的 AWS SDK v3。

## 命令

从仓库根目录执行：

```powershell
pnpm --dir lambda/api install --frozen-lockfile
pnpm --dir lambda/api test
pnpm --dir lambda/api package
```

推荐的精简部署包输出到：

```text
lambda/api/dist/random-redirect-link-api.zip
```

需要固定并包含 AWS SDK v3 版本时，可执行：

```powershell
pnpm --dir lambda/api package:self-contained
```

自包含包输出到
`lambda/api/dist/random-redirect-link-api-self-contained.zip`。

最小权限 IAM、API Gateway 路由、备份、冒烟测试、日志和回滚步骤请参阅
[简体中文部署教程](../../docs/lambda-api-deployment.zh-CN.md)或
[English deployment guide](../../docs/lambda-api-deployment.en.md)。

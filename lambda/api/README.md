# random-redirect-link-api Lambda

[简体中文](README.zh-CN.md) | English

This directory contains the version-controlled source for the public
`random-redirect-link-api` Lambda function.

The function reads a link record by its `path` key, returns `404` for missing or
disabled records, and emits a no-cache `301` or `302` redirect. It supports both
random-subdomain records and fixed `targetUrl` records. `HEAD` returns the same
status and headers as `GET` with an empty body.

The source is split by responsibility under `src/`. The production build is a
single `index.mjs` bundle with handler `index.handler` and uses the AWS SDK v3
included in the Node.js 24 Lambda runtime by default.

## Commands

Run from the repository root:

```powershell
pnpm --dir lambda/api install --frozen-lockfile
pnpm --dir lambda/api test
pnpm --dir lambda/api package
```

The recommended deployment package is written to:

```text
lambda/api/dist/random-redirect-link-api.zip
```

To create an optional self-contained package with pinned AWS SDK v3 clients:

```powershell
pnpm --dir lambda/api package:self-contained
```

This writes `lambda/api/dist/random-redirect-link-api-self-contained.zip`.

See the deployment guide in
[English](../../docs/lambda-api-deployment.en.md) or
[Simplified Chinese](../../docs/lambda-api-deployment.zh-CN.md) for IAM, API
Gateway routes, backup, smoke testing, logging, and rollback.

# random-redirect-link-admin Lambda

[简体中文](README.zh-CN.md) | English

This directory contains the version-controlled source for the
`random-redirect-link-admin` Lambda function.

The source is split by responsibility under `src/`. The default production
package is a single `index.mjs` bundle with handler `index.handler` and uses the
AWS SDK v3 included in the Node.js 24 Lambda runtime.

`POST /links` defaults `randomSubdomain` to `true` when the field is omitted.
Clients can explicitly send `false` to create a fixed-target link; in that mode
`subdomainLength` is not required or stored.

## Commands

Run these commands from the repository root:

```powershell
pnpm --dir lambda/admin install --frozen-lockfile
pnpm --dir lambda/admin test
pnpm --dir lambda/admin package
```

The deployment package is written to:

```text
lambda/admin/dist/random-redirect-link-admin.zip
```

To create an optional self-contained package with the pinned AWS SDK v3 clients
included, run:

```powershell
pnpm --dir lambda/admin package:self-contained
```

This writes `lambda/admin/dist/random-redirect-link-admin-self-contained.zip`.

See the deployment guide in
[English](../../docs/lambda-admin-deployment.en.md) or
[Simplified Chinese](../../docs/lambda-admin-deployment.zh-CN.md) for AWS
configuration, least-privilege IAM, API Gateway integration, smoke testing,
and rollback.

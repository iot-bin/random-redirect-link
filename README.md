# Random Redirect Link Console

[简体中文](README.zh-CN.md) | English

A Next.js management console and version-controlled AWS Lambda source for
creating, listing, editing, enabling, disabling, and deleting redirect links.
The console supports Simplified Chinese, Traditional Chinese, and English.

## Architecture

```text
Browser
  -> Next.js console routes
  -> Admin HTTP API
  -> random-redirect-link-admin Lambda
  -> DynamoDB

Visitor opens a short link
  -> Public HTTP API
  -> random-redirect-link-api Lambda
  -> DynamoDB
  -> HTTP 301 or 302 redirect
```

The browser never receives an Admin API token. Next.js resolves the selected
target on the server, attaches its Bearer token, and forwards the request.

## Features

- Create random-subdomain or fixed-target redirect links.
- Browse links with cursor pagination and path-prefix filtering.
- View, edit, enable, disable, and delete individual links.
- Batch enable, disable, or delete up to 50 links.
- Switch between `zh-CN`, `zh-TW`, and `en` in the console.
- Select from multiple independently configured API environments.
- Build either small Lambda packages that use the runtime-provided AWS SDK v3
  or optional self-contained packages with pinned SDK dependencies.

## Project Layout

```text
app/                 Next.js App Router pages and server routes
lib/                 API target, validation, session, and i18n modules
lambda/admin/        Admin Lambda source, tests, and packaging
lambda/api/          Public redirect Lambda source, tests, and packaging
docs/                English and Simplified Chinese deployment guides
public/              Static assets, including the project favicon
```

## Requirements

- Node.js compatible with Next.js 16
- npm for the root Next.js project
- Node.js 24 and pnpm 11 for the Lambda subprojects
- PowerShell 7 for the included ZIP packaging scripts

## Console Configuration

Copy `.env.example` to `.env.local` and set:

```env
CONSOLE_PASSWORD=replace-with-a-strong-password
SITE_TITLE=Short Link Console
SITE_DESCRIPTION=Create, query, and manage redirect links
API_TARGETS=[{"id":"prod","name":"Production","apiBaseUrl":"https://admin-api.example.com","adminToken":"replace-with-the-admin-token","redirectBaseUrl":"https://go.example.com"}]
DEFAULT_TARGET_ID=prod
```

| Variable | Required | Purpose |
|---|---:|---|
| `CONSOLE_PASSWORD` | Yes | Signs the console session and protects login. |
| `API_TARGETS` | Yes | JSON array of Admin API environments. |
| `DEFAULT_TARGET_ID` | No | Initially selected target; otherwise the first valid target is used. |
| `SITE_TITLE` | No | Browser title and console branding. |
| `SITE_DESCRIPTION` | No | Page metadata description. |

Each `API_TARGETS` entry requires:

- `id`: stable unique identifier.
- `name`: label displayed in the console.
- `apiBaseUrl`: HTTPS Admin API base URL.
- `adminToken`: matching Admin Lambda Bearer token; server-side only.
- `redirectBaseUrl`: public short-link origin displayed by the console.

Do not use a `NEXT_PUBLIC_` prefix for `adminToken` or any other secret.

## Local Development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` and sign in with `CONSOLE_PASSWORD`.

Useful checks:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## Lambda Sources

| Function | Source | Handler | Required environment variables |
|---|---|---|---|
| `random-redirect-link-admin` | `lambda/admin` | `index.handler` | `TABLE_NAME`, `ADMIN_TOKEN`; optional `LINKS_INDEX_NAME` |
| `random-redirect-link-api` | `lambda/api` | `index.handler` | `TABLE_NAME` |

Build the recommended small packages:

```powershell
pnpm --dir lambda/admin install --frozen-lockfile
pnpm --dir lambda/admin package
pnpm --dir lambda/api install --frozen-lockfile
pnpm --dir lambda/api package
```

Both default packages externalize `@aws-sdk/*` and use the AWS SDK v3 included
in the Node.js 24 Lambda runtime. To pin and include the SDK instead, run
`package:self-contained` in the corresponding Lambda directory.

## Deployment Guides

- Complete AWS SAM infrastructure: [English](docs/infrastructure.en.md) |
  [简体中文](docs/infrastructure.zh-CN.md)
- Admin Lambda: [English](docs/lambda-admin-deployment.en.md) |
  [简体中文](docs/lambda-admin-deployment.zh-CN.md)
- Public API Lambda: [English](docs/lambda-api-deployment.en.md) |
  [简体中文](docs/lambda-api-deployment.zh-CN.md)

The guides cover packaging, least-privilege IAM, API Gateway routes, backups,
smoke tests, logs, and rollback. Building a package does not deploy it.

## Security and Operations

- Use a strong `CONSOLE_PASSWORD` and a separate high-entropy Admin token.
- Store production secrets only in the hosting platform and Lambda configuration;
  never commit `.env.local`, tokens, downloaded Lambda packages, or backups.
- The public redirect API is intentionally unauthenticated. Apply API Gateway
  throttling and monitor Lambda errors, throttles, and duration.
- Scope the public Lambda role to `dynamodb:GetItem` on the link table. Scope the
  Admin Lambda role only to the table and its listing index operations.
- Keep deployment backups outside Git and verify the function state before and
  after each code update.

## Contributing and Security

- See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, validation, and pull
  request expectations.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## License

Licensed under the [Apache License 2.0](LICENSE).

## Recycle bin and link schedules

Links accept optional ISO 8601 startsAt/expiresAt timestamps with an explicit timezone. Null clears a timestamp on PATCH; an omitted field is unchanged. The console displays Singapore time (UTC+8). GET and HEAD check deletion, enabled state and the current time on every request. Existing links without these fields remain compatible.

DELETE and batch delete now soft-delete links for 7 days; repeating deletion does not extend retention. GET /links?view=trash lists deleted links (default view=links excludes them). PATCH /links/{path} with restore:true restores a link, optionally including revised schedule fields. Batch action restore supports up to 50 paths. Restoration preserves enabled state; an elapsed expiry must be extended or cleared. Recovery/renewal is refused at the retention deadline. Paths remain reserved until physical deletion.

DynamoDB TTL uses numeric Unix seconds in purgeAt, never expiresAt. Normal expiry schedules cleanup 7 days later; manual deletion schedules cleanup 7 days after deletion. TTL deletion is asynchronous. List filtering preserves pagination cursors; GSI results are eventually consistent. Conditional updates protect concurrent mutations; direct item reads are strongly consistent.

Deployment order: deploy the public Lambda with lifecycle checks first, then the admin Lambda and console; enable TTL on purgeAt last after verification. The SAM template declares this TTL field for managed stacks. Existing manually managed production resources must be updated separately after approval; do not create a replacement table. No new API Gateway route is needed: restore uses the existing PATCH and batch routes. No production resource was changed during local implementation.

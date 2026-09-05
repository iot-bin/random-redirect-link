# Contributing

Thanks for helping improve Random Redirect Link.

## Before You Start

- Search existing issues and pull requests before proposing duplicate work.
- Open an issue before making a large behavioral or infrastructure change.
- Never include credentials, `.env.local`, deployment packages, or production
  data in a contribution.
- Keep commits focused and use an English Conventional Commit subject, such as
  `fix(console): reconcile failed batch actions`.

## Local Setup

Requirements are documented in [README.md](README.md). For the Next.js console:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

For Lambda development:

```powershell
pnpm --dir lambda/admin install --frozen-lockfile
pnpm --dir lambda/api install --frozen-lockfile
```

Use only local or explicitly authorized test infrastructure. Do not point a
development console at production unless the change requires it and you have
permission.

## Validate Your Changes

Run the checks relevant to the files you changed:

```powershell
npm run lint
npx tsc --noEmit
npm run build
pnpm --dir lambda/admin check
pnpm --dir lambda/admin test
pnpm --dir lambda/api check
pnpm --dir lambda/api test
```

When changing `template.yaml`, also run `sam validate --lint` if the AWS SAM CLI
is available.

## Pull Requests

- Explain the user-visible behavior and why the change is needed.
- List validation commands and their results.
- Add or update tests for behavior changes.
- Update English and Chinese documentation when configuration or deployment
  steps change.
- Include screenshots for meaningful UI changes at desktop and mobile widths.
- Keep unrelated local or IDE files out of the pull request.

## Licensing

By submitting a contribution, you agree that it may be distributed under the
Apache License 2.0 and confirm that you have the right to contribute it.

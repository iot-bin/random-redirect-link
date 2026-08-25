This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration

Create a `.env.local` file in the root directory with the following variables:

```env
# Console Authentication
CONSOLE_PASSWORD=your-console-password

# Branding Configuration
SITE_TITLE=Microbin Console
SITE_DESCRIPTION=Microbin short link console
SITE_SUBTITLE=创建自定义路径短链接（跳转）

# API Targets Configuration (JSON format)
# Define multiple API environments with their credentials and redirect domains
API_TARGETS=[{"id":"prod","name":"Production (link.microbin.dev)","apiBaseUrl":"https://api.link.microbin.dev","adminToken":"your-prod-admin-token","redirectBaseUrl":"https://link.microbin.dev"},{"id":"staging","name":"Staging (link-staging.microbin.dev)","apiBaseUrl":"https://api-staging.link.microbin.dev","adminToken":"your-staging-admin-token","redirectBaseUrl":"https://link-staging.microbin.dev"}]

# Default target ID (optional, defaults to first target in API_TARGETS)
DEFAULT_TARGET_ID=prod
```

### Required Variables

- `CONSOLE_PASSWORD`: The password required to access the console
- `API_TARGETS`: JSON array of API target configurations (see below)

### API Targets Configuration

The `API_TARGETS` variable defines multiple API environments that can be selected in the console. Each target must have:

- `id`: Unique identifier for the target (e.g., "prod", "staging")
- `name`: Display name shown in the UI (e.g., "Production (link.microbin.dev)")
- `apiBaseUrl`: The backend Admin API URL (e.g., "https://api.link.microbin.dev")
- `adminToken`: Secret admin token for the API (kept server-side only)
- `redirectBaseUrl`: The public short link domain (e.g., "https://link.microbin.dev")

Example with multiple environments:

```json
[
  {
    "id": "prod",
    "name": "Production (link.microbin.dev)",
    "apiBaseUrl": "https://api.link.microbin.dev",
    "adminToken": "your-prod-admin-token",
    "redirectBaseUrl": "https://link.microbin.dev"
  },
  {
    "id": "staging",
    "name": "Staging (link-staging.microbin.dev)",
    "apiBaseUrl": "https://api-staging.link.microbin.dev",
    "adminToken": "your-staging-admin-token",
    "redirectBaseUrl": "https://link-staging.microbin.dev"
  }
]
```

### Optional Branding Variables

- `SITE_TITLE`: Browser tab title and main heading (default: `Microbin Console`)
- `SITE_DESCRIPTION`: Page meta description (default: `Microbin short link console`)
- `SITE_SUBTITLE`: Page subtitle (default: `创建自定义路径短链接（跳转）`)
- `DEFAULT_TARGET_ID`: Default selected API target (defaults to first target)

**Security Note**: The `adminToken` values are kept server-side only and never exposed to the browser. Only the `redirectBaseUrl` is sent to the frontend for displaying the short link domain.

**Deployment on Vercel or other platforms**: Set these environment variables in your platform's dashboard (e.g., Vercel Project Settings → Environment Variables). All sensitive credentials remain server-side.

## Redirect Modes

The create form supports two redirect modes:

- **Random subdomain** is enabled by default. Each visit generates a new target
  subdomain, and the random string length can be configured from 3 to 32.
- **Fixed target URL** can be selected by turning off random subdomains. The
  short link then redirects directly to the configured target URL.

Deploy the Admin Lambda source in this repository before enabling fixed-target
creation in the console. The public redirect Lambda must also honor records
where `randomSubdomain` is `false` by redirecting to the stored `targetUrl`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You will be redirected to the login page. Enter the password you configured in `CONSOLE_PASSWORD` to access the console.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Admin Lambda Source

The version-controlled source for `random-redirect-link-admin` is located in
[`lambda/admin`](lambda/admin). It is split into small ESM modules and uses the
AWS SDK v3 included in the Node.js 24 Lambda runtime by default. A self-contained
package with pinned SDK clients is also available as an optional build.

See the [Chinese Admin Lambda deployment guide](docs/lambda-admin-deployment.zh-CN.md)
for packaging, API Gateway integration, smoke testing, and rollback instructions.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

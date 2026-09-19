# db-rebuild management plane

This branch uses Cognito, DynamoDB, a control Lambda and IAM. Secrets Manager and shared
Admin Tokens are not used. Source changes do not deploy resources. Missing `MANAGEMENT_API_URL` deliberately prevents sign-in.

## Deployment records

Set the server-only `MANAGEMENT_API_URL` in the hosting platform to the management stack's `ManagementApiUrl` output. For local development, copy `.env.example` to ignored `.env.local` and set that value. Keep real workspace inputs in ignored `config/workspace.local.json`.

The management service exposes only title, description, Region and Cognito Client ID at `/public/site`. Next.js caches valid responses for 60 seconds per instance and coalesces concurrent requests. Failures are not cached; expired configuration is not reused. Authenticated environment, permission and session requests remain uncached. This trusted operator-configured HTTPS endpoint is the source of authentication configuration and must not come from user requests.

Deploy the updated control Lambda first, then set the variable for the intended Vercel environment and deploy from Git. No local bootstrap JSON, tracing override or prebuilt upload is required. Restart local development after changing the variable; redeploy Vercel after changing it. An older control API without the login fields fails closed until upgraded.

Keep account IDs, resource names, endpoints, administrator details and test results in private operational records outside Git. Deploy isolated test resources before production migration. Retained resources require explicit cleanup.

## Boundaries

The existing Next.js same-origin API routes forward the user's access token. Cognito tokens
are kept in HttpOnly, production-Secure, SameSite=Strict cookies; mutations check Origin.
Proxy is only an optimistic navigation guard. API Gateway verifies JWTs; the control Lambda
checks access-token claims, revocation, current Cognito account status and current membership.
Every environment operation, including batches, is authorized independently.

Backend API IDs are restricted by deployment configuration and by the control role's exact
execute-api permissions. The control Lambda signs requests and does not follow redirects.
Admin handlers accept only the designated IAM role from the API Gateway IAM context.
Direct lambda:InvokeFunction access must remain restricted to trusted operators; direct
invokers can manufacture event payloads. Public redirects remain independent of the control plane.

## Data

One workspace per stack. A retained, PITR-enabled, on-demand configuration table stores
CONFIG, OWNER, MEMBER#sub, PREF#sub and revoked SESSION#origin_jti records under WS#workspace.
Configuration and member edits use version conditions. Logout revokes the token family for
eight days, longer than the seven-day Cognito refresh lifetime. Preferences persist environment
and page size; language and theme remain browser preferences.

A separate retained audit table stores attempts before mutations and outcomes afterward.
If outcome logging fails, HTTP 503 does not imply that the mutation failed: reconcile by reading.
No passwords, tokens or full request bodies are logged. The UI shows the latest 100 events.
Audit records have no automatic expiration; define a retention/export policy before large-scale use.

## Build and initialize

Use npm/package-lock at the root, pnpm in Lambda packages. Run the frontend type check/build,
all three Lambda test suites, `pnpm --dir lambda/control build`, and
`cfn-lint infrastructure/control.yaml template.yaml`. The control bundle includes its SDK dependencies.

Deploy only `infrastructure/control.yaml` for the new management resources. The root template
creates new redirect resources and must not be applied over manually managed production resources.
Supply BackendApiIds and matching BackendInvokeArns such as
`arn:aws:execute-api:ap-southeast-1:<account>:<api-id>/*/*/links*`; do not grant account-wide access.

Create the user-approved owner in the new Cognito pool. This sends a temporary-password email;
never put that password into source or logs. Export stack Outputs as JSON, verify the initial
environment configuration, then run:

```powershell
node lambda/control/scripts/initialize.mjs stack-outputs.json config/workspace.example.json <owner-email> main
```

The script uses the standard local AWS credential chain; explicitly select the intended profile
and region. It verifies an existing enabled owner, atomically creates three records without
overwriting existing data. It does not create users, send mail or write frontend configuration.
Set MANAGEMENT_API_URL from the stack output after initialization.
The example API/domain mappings require live verification before use.

## Cutover and rollback

Validate an isolated environment first: login, new password, recovery, TOTP, logout, viewer/editor
authorization, cross-environment rejection and batches. Back up old function packages/configuration,
all API routes/integrations and the old frontend deployment outside Git.

For each environment, switch **all** Admin routes (including ANY/$default if present) to AWS_IAM
before deploying the IAM-only handler and MANAGEMENT_ROLE_ARN. Preserve table/index/maintenance
settings. This intentionally introduces a short management outage rather than an anonymous gap.
Verify payload format 2.0 and the API Gateway IAM caller context. Verify old Bearer tokens, unsigned
calls and wrong roles fail, while the designated control role works. Public redirects must still work.
Remove ADMIN_TOKEN only after the transition is verified, deploy the configured frontend, then
remove obsolete Vercel business environment variables.

Rollback keeps AWS_IAM enabled until the old token-checking handler and configuration are restored;
only then restore the old routes and frontend. Never remove route authentication first.
No short-link tables are copied or rolled back by this change.

## Scope and limitations

The initial release supports invitation, member activation, environment grants, owner protection,
site/environment editing, user preferences, password recovery and optional TOTP. Cognito default
email delivery has quotas; configure SES before growing usage. An interrupted invitation can leave
a Cognito user without membership: retrieve its sub and add membership with PUT /members.
It does not yet implement self-registration, SSO, mandatory MFA_SETUP, multiple workspaces,
or audit export. Do not require MFA at pool level until the MFA_SETUP challenge is implemented.

Vercel stores only MANAGEMENT_API_URL, a non-secret connection address. Region and Cognito client ID
are discovered from the management service and are not committed to Git. TABLE_NAME, LINKS_INDEX_NAME, WRITE_DISABLED and MANAGEMENT_ROLE_ARN
remain AWS deployment settings. The control stack injects its own table/pool/client IDs and allowlist.

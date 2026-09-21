# Management service deployment

The management service uses Cognito, DynamoDB, a control Lambda and IAM. Source changes do not deploy resources. Missing `MANAGEMENT_API_URL` deliberately prevents sign-in.

## Deployment records

Set the server-only `MANAGEMENT_API_URL` in the hosting platform to the management stack's `ManagementApiUrl` output. For local development, copy `.env.example` to ignored `.env.local` and set that value. Keep real workspace inputs in ignored `config/workspace.local.json`.

The management service exposes only title, description, Region and Cognito Client ID at `/public/site`. Next.js caches valid responses for 60 seconds per instance and coalesces concurrent requests. Failures are not cached; expired configuration is not reused. Authenticated environment, permission and session requests remain uncached. This trusted operator-configured HTTPS endpoint is the source of authentication configuration and must not come from user requests.

Deploy the control Lambda first, then set the variable for the intended Vercel environment and deploy from Git. No local bootstrap JSON, tracing override or prebuilt upload is required. Restart local development after changing the variable; redeploy Vercel after changing it.

Keep account IDs, resource names, endpoints, administrator details and test results in private operational records outside Git. Deploy isolated test resources before production deployment. Retained resources require explicit cleanup.

## Boundaries

The Next.js same-origin API routes forward the user's access token. Cognito tokens
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

Deploy only `infrastructure/control.yaml` for management resources. The root template
creates new redirect resources and must not be applied over manually managed production resources.
Supply BackendApiIds and matching BackendInvokeArns such as
`arn:aws:execute-api:ap-southeast-1:<account>:<api-id>/*/*/links*`; do not grant account-wide access.

Create the user-approved owner in the Cognito pool. This sends a temporary-password email;
never put that password into source or logs. Export stack Outputs as JSON, copy `config/workspace.example.json` to ignored
`config/workspace.local.json`, and fill in the verified API ID, stage and redirect domain. Then run:

```powershell
node lambda/control/scripts/initialize.mjs stack-outputs.json config/workspace.local.json <owner-email> main
```

The script uses the standard local AWS credential chain; explicitly select the intended profile
and region. It verifies an existing enabled owner, atomically creates three records without
overwriting existing data. It does not create users, send mail or write frontend configuration.
Set MANAGEMENT_API_URL from the stack output after initialization.
The example API/domain mappings require live verification before use.

## Validation and rollback

Validate login, first-login password change, recovery, TOTP, logout, viewer/editor permissions,
cross-environment rejection and batch actions in an isolated environment. Verify every Admin
route uses `AWS_IAM`, payload format 2.0 and the designated management role. Unsigned calls and
calls from other roles must fail; public redirects must remain available.

Before updates, back up function packages, configuration, API routes/integrations and the frontend
deployment outside Git. Roll back to a compatible Cognito/IAM version while retaining route
authentication and role checks. Code rollback does not restore data or configuration; reconcile
writes and audit results before retrying operations.

## Scope and limitations

The service supports invitation, member activation, environment grants, owner protection,
site/environment editing, user preferences, password recovery and optional TOTP. Cognito default
email delivery has quotas; configure SES before growing usage. An interrupted invitation can leave
a Cognito user without membership: retrieve its sub and add membership with PUT /members.
It does not yet implement self-registration, SSO, mandatory MFA_SETUP, multiple workspaces,
or audit export. Do not require MFA at pool level until the MFA_SETUP challenge is implemented.

Vercel stores only MANAGEMENT_API_URL, a non-secret connection address. Region and Cognito client ID
are discovered from the management service and are not committed to Git. TABLE_NAME, LINKS_INDEX_NAME, WRITE_DISABLED and MANAGEMENT_ROLE_ARN
remain AWS deployment settings. The control stack injects its own table/pool/client IDs and allowlist.

# AWS SAM infrastructure

The root `template.yaml` defines the backend infrastructure for this project:

- one DynamoDB table with the `links-by-path` global secondary index;
- separate Admin and public HTTP APIs;
- separate Lambda functions for administration and redirects;
- a generated Admin bearer token in AWS Secrets Manager;
- API access logs, Lambda log retention, tracing, throttling, and least-privilege IAM.

## Before you deploy

The template creates new resources. It does not automatically adopt an existing table, APIs, functions, or secret. For an existing installation, either import supported resources into a CloudFormation stack or deploy a parallel environment and migrate traffic and data deliberately.

The DynamoDB table and Admin token secret both use `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`. Deleting the stack therefore leaves those stateful resources behind for recovery or manual cleanup.

## Validate and build

Install the AWS SAM CLI, `cfn-lint`, and `cfn-guard`, then run:

```powershell
sam validate --lint
cfn-lint template.yaml
sam build
```

Run your organization's `cfn-guard` rules against `template.yaml` before a production deployment.

## Deploy

For an interactive first deployment:

```powershell
sam deploy --guided
```

Use a separate stack and parameter set for each environment. At minimum, review `Environment`, log retention, and API rate and burst limits.

After deployment, copy the `AdminApiBaseUrl` and `PublicApiBaseUrl` outputs into `API_TARGETS`. Retrieve the generated Admin token only through an authorized Secrets Manager client and supply it as `adminToken`; do not commit the token.

## Production checklist

- Confirm both API URLs use HTTPS.
- Restrict access to the generated secret. After rotating it in Secrets Manager, redeploy the Admin function configuration so the new value is resolved.
- Verify CloudWatch access and function logs, alarms, and retention.
- Test create, list, update, batch, delete, GET redirect, and HEAD redirect behavior.
- Back up or export an existing DynamoDB table before migrating data or traffic.

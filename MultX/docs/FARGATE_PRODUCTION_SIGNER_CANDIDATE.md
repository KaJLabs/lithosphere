# MultX Fargate production signer candidate

Status: build and transaction-free preflight only. MultX and release signing
remain disabled.

## Trust boundaries

Each of the seven signers has a distinct ECS service, task role, KMS key,
DynamoDB decision table, bearer-token secret, target group, and security-group
path. No task role may access another signer's key, decision table, or token.
The intended contract threshold is 5-of-7, but contract rotation is a separate
audited change.

The API reaches each signer through a private HTTPS endpoint. TLS terminates at
an internal load balancer. Only the load-balancer security group may reach the
signer container. The application additionally requires a unique bearer token
for `/v1/identity` and `/v1/sign-release`. The health endpoint contains no
secret or signing operation.

## Minimum signer task-role permissions

Scope every statement to that signer's single KMS key or DynamoDB table.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UseAssignedSigningKey",
      "Effect": "Allow",
      "Action": ["kms:GetPublicKey", "kms:Sign"],
      "Resource": "KMS_KEY_ARN"
    },
    {
      "Sid": "UseAssignedDecisionTable",
      "Effect": "Allow",
      "Action": ["dynamodb:DescribeTable", "dynamodb:PutItem"],
      "Resource": "DYNAMODB_TABLE_ARN"
    }
  ]
}
```

The ECS execution role—not the signer task role—handles ECR image pulls,
CloudWatch log delivery, and retrieval of the one bearer-token secret declared
in the task definition. Restrict `secretsmanager:GetSecretValue` to that
secret. No AWS access key is embedded or stored.

No TOTP seed workflow exists in this signer, so no TOTP KMS key or encrypt/
decrypt permission is required.

## Signing controls

Before every signature, the signer independently:

1. validates the request against its local source/route policy;
2. checks the RPC-reported source chain ID;
3. requires the configured confirmation depth;
4. queries and matches the exact `TokensLocked` event;
5. recomputes the release hash;
6. conditionally records `(sourceChain, sourceNonce) -> hash` in DynamoDB; and
7. asks only its assigned KMS key to sign the recomputed hash.

The conditional DynamoDB write happens before KMS signing and rejects a
different hash for an existing decision key. This provides durable
anti-equivocation across task replacement and concurrent requests.

## Fail-closed activation

`SIGNER_RELEASE_SIGNING_ENABLED` defaults to false. While false, the signing
route returns HTTP 503 and cannot reach RPC, DynamoDB decision writes, or KMS
transaction signing. Startup performs only a fixed transaction-free KMS
signature/recovery check and a DynamoDB table/schema readiness check.

Enabling signing requires all of the following outside this code change:

- independent security audit and accepted fix review;
- approved contracts, routes, caps, governance and 5-of-7 signer set;
- private endpoint, secret, monitoring, backup and rollback validation;
- transaction-free canary and explicit production change approval.

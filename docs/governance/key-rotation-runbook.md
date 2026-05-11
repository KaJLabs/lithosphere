# Key & Secret Rotation Runbook

Operational procedures for routine and emergency rotation of secrets, credentials, and signing material across the Lithosphere stack.

> Schedule and SLAs are defined in [`docs/guides/security-checklist.md`](../guides/security-checklist.md). This runbook covers **how**, not **when**.

## Pre-flight (every rotation)

1. Confirm an active maintenance window or that the secret can be rotated zero-downtime (most below can).
2. Notify `#litho-oncall` with `START-ROTATION <secret-type> <env>`.
3. Open a tracking issue using the **Incident / Operational Change** issue template (label: `rotation`).
4. Have a rollback plan ready: keep the previous secret active until the new one is verified in use.

## Authority Matrix

| Secret Type           | Initiator       | Approver        | Witness        |
|-----------------------|-----------------|-----------------|----------------|
| API Keys (3rd party)  | Oncall          | Security Lead   | —              |
| DB Credentials        | Oncall          | Security Lead   | DBA            |
| TLS Certificates      | Automated (ACM) | Security Lead   | —              |
| Cosign Signing Keys   | Security Lead   | CAB             | Release Eng    |
| SSH Keys (bastion)    | Oncall          | Security Lead   | —              |
| Root CA               | CAB             | CAB + CTO       | Security Lead  |
| GHCR / Registry Tokens| Release Eng     | Security Lead   | —              |
| AWS OIDC Role Trust   | Platform Eng    | Security Lead   | —              |

## Routine Rotation — by Secret Type

### API Keys (third-party services, 90 days)

Examples: WalletConnect / Reown project ID rotation, RPC provider keys.

1. **Generate** new key in the provider console. Do **not** revoke the old one yet.
2. **Stage** new value in AWS Secrets Manager:
   ```sh
   aws secretsmanager put-secret-value \
     --secret-id litho/prod/<service>/<key-name> \
     --secret-string '{"value":"<new-key>"}'
   ```
3. **Roll** the consuming service(s) — `docker compose up -d --force-recreate <service>` on the indexer EC2 (or trigger `deploy-simple.yaml` if the secret is read at build time).
4. **Verify**: confirm the service emits no auth-error metrics for 15 minutes; check provider dashboard shows traffic against the new key.
5. **Revoke** the old key in the provider console.
6. Close the rotation issue with the new key's last-4 and rotation timestamp.

### Database Credentials (90 days)

1. Create a new IAM user / Postgres role with the same grants:
   ```sql
   CREATE ROLE litho_api_v2 LOGIN PASSWORD '<generated>';
   GRANT ALL PRIVILEGES ON DATABASE litho TO litho_api_v2;
   ```
2. Update Secrets Manager (`litho/prod/postgres/url`).
3. Restart `litho-api` and `litho-indexer` services. Both must reconnect cleanly.
4. Drop the old role only after **24h** of successful operation:
   ```sql
   REASSIGN OWNED BY litho_api_v1 TO litho_api_v2;
   DROP ROLE litho_api_v1;
   ```

### TLS Certificates (90 days, automated)

AWS ACM auto-renews 60 days before expiry. Manual intervention only if:
- DNS validation drifts: re-issue via `aws acm request-certificate ...`.
- Nginx on Sentry 1 isn't picking up renewal: `sudo nginx -s reload`.

Verify:
```sh
echo | openssl s_client -servername rpc.litho.ai -connect rpc.litho.ai:443 2>/dev/null \
  | openssl x509 -noout -dates
```

### Cosign Signing Keys (annual)

> **Note**: We use Cosign keyless via OIDC in CI. Long-lived signing keys are reserved for offline signing scenarios. If/when we adopt offline keys, this section applies.

1. Generate a new keypair offline:
   ```sh
   COSIGN_PASSWORD=<vault-stored> cosign generate-key-pair
   ```
2. Store `cosign.key` in AWS Secrets Manager (`litho/sign/cosign/private`), upload `cosign.pub` to `docs/security/` and tag in git.
3. Update `publish-images.yaml` to reference the new key id.
4. Re-sign the latest mainnet release with both old and new keys for a 30-day grace window.
5. After 30 days, remove the old public key from the verification policy.

### SSH Keys — Bastion (annual)

1. Generate new keypair locally:
   ```sh
   ssh-keygen -t ed25519 -f litho-bastion-2026 -C "bastion@litho 2026"
   ```
2. Add public key to the bastion via SSM (do NOT log into bastion to do this — it must come from SSM in case the old key is compromised):
   ```sh
   aws ssm send-command --instance-ids <bastion-id> \
     --document-name AWS-RunShellScript \
     --parameters 'commands=["echo \"<pubkey>\" >> /home/ec2-user/.ssh/authorized_keys"]'
   ```
3. Verify connectivity from a new shell.
4. Remove the old public key:
   ```sh
   aws ssm send-command --instance-ids <bastion-id> \
     --document-name AWS-RunShellScript \
     --parameters 'commands=["sed -i \"/<old-key-fingerprint>/d\" /home/ec2-user/.ssh/authorized_keys"]'
   ```
5. Update GitHub Actions secret `BASTION_SSH_KEY` (same procedure for `INDEXER_SSH_KEY`).
6. Re-run the latest successful `deploy-simple.yaml` to confirm CI still has access.

### Root CA (5 years)

Out of scope for this runbook — coordinated through CAB with a dedicated migration plan. Touchpoint here is procedural: ensure `docs/governance/` carries the migration plan from the prior cycle, and that the new CA is published in `docs/security/` with overlapping validity ≥ 12 months.

### GHCR / Registry Tokens

Per-repo GHCR uses `GITHUB_TOKEN` short-lived via `permissions: packages: write` — no manual rotation. If a long-lived PAT was created in error, revoke it immediately at https://github.com/settings/tokens.

### AWS OIDC Role Trust Policy

No secret to rotate, but review the trust policy on `litho-mainnet-github-actions-deployer` annually:
```sh
aws iam get-role --role-name litho-mainnet-github-actions-deployer \
  | jq '.Role.AssumeRolePolicyDocument'
```
Confirm `token.actions.githubusercontent.com` is the only federated principal and that `sub` claim restricts to the expected repo and refs.

## Emergency Rotation

Triggered by suspected compromise. Follow the SLAs in [`security-checklist.md`](../guides/security-checklist.md#emergency-rotation-sla):

| Severity | Revoke Within | Deploy New Within |
|----------|---------------|-------------------|
| Critical | 1 hour        | 4 hours           |
| High     | 4 hours       | 24 hours          |
| Medium   | 24 hours      | 72 hours          |

Procedure:

1. **Page** security-lead and oncall (PagerDuty: `litho-security` policy).
2. **Revoke first, rotate second**. Revocation is the SLA-critical step; deploying the new secret can take longer if rollback safety requires it.
3. **Audit**: pull CloudTrail / GitHub audit log for the last 30 days filtered by the compromised secret. Save to an incident folder in S3 (`s3://litho-incidents/<date>-<short-desc>/`).
4. **Isolate blast radius**: identify every workload that consumed the secret and confirm they're rotated or shut down before any external announcement.
5. **PIR** within 5 business days using [`pir-template.md`](./pir-template.md).

## Quarterly Drill

Phase 10 acceptance criterion: "Quarterly security drill passes." Each quarter, run a **tabletop** rotation of one randomly-selected secret type without coordinating in advance with the wider team. Record results in the PIR template and file action items for any gaps surfaced.

## Verification After Any Rotation

- [ ] Secret consumed by the service (no auth errors in logs for 15 minutes)
- [ ] Old value rejected by the provider (test with curl / explicit auth attempt)
- [ ] Tracking issue closed with last-4 of new secret and timestamp
- [ ] Rotation date logged in `docs/security/rotation-log.md` (append-only)
- [ ] If signing material: confirm `cosign verify` succeeds against a freshly-published image

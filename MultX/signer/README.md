# MultX independent signer

The signer supports two isolated deployment modes:

- an AWS ECS Fargate production candidate using one non-exportable KMS key and
  one DynamoDB anti-equivocation table per signer; and
- the existing file-key/mTLS mode for non-production rehearsal and independent
  VPS operation.

Production refuses file-backed keys. The MultX API connects through a private
TLS load balancer using a bearer token injected from the secret manager. The
KMS private key never leaves AWS KMS or enters a container or repository.

Deployment templates and operator acceptance steps are in
[`compose.example.yaml`](./compose.example.yaml) and
[`OPERATOR_RUNBOOK.md`](./OPERATOR_RUNBOOK.md).

The signer does not blindly sign an API-provided digest. For every request it:

1. validates the configured source chain, bridge, token route and destination;
2. rejects duplicate routes, zero addresses, missing confirmation depth, and
   non-HTTPS source RPCs (except loopback rehearsal);
3. queries its own source-chain RPC, verifies its reported chain ID, and requires
   the explicit confirmation depth;
4. verifies the exact `TokensLocked` event at the supplied block;
5. recomputes the release hash locally;
6. records an fsync-backed `(sourceChain, sourceBridge, sourceNonce) -> hash` decision before
   signing and rejects equivocation, including after restart; and
7. returns an EIP-191 signature only after those checks pass.

## Fargate production-candidate configuration

- `SIGNER_KMS_KEY_ARN`: one `ECC_SECG_P256K1` KMS key.
- `SIGNER_DYNAMODB_TABLE`: a table whose partition key is the string
  `decisionKey`.
- `SIGNER_JOURNAL_BACKEND=dynamodb`.
- `SIGNER_POLICY_JSON` or `SIGNER_POLICY_FILE`: reviewed route allowlist.
- `SIGNER_TRANSPORT=proxy-http` and `SIGNER_BEHIND_TLS_PROXY=true`.
- `SIGNER_BEARER_TOKEN` or `SIGNER_BEARER_TOKEN_FILE`: a 32-512 character
  secret. In ECS, inject the environment value from Secrets Manager; never
  put the value in a task definition or repository.
- `SIGNER_RELEASE_SIGNING_ENABLED=false` until every activation gate passes.

The load balancer must terminate HTTPS, add `X-Forwarded-Proto: https`, and
be the only security-group source allowed to reach port 8080. `/health` is
unauthenticated for load-balancer health checks; all identity and signing
routes require the bearer token.

## VPS rehearsal files

- `SIGNER_PRIVATE_KEY_FILE`: validator ECDSA private key, readable only by the
  rootless container user.
- `SIGNER_TLS_CERT_FILE` and `SIGNER_TLS_KEY_FILE`: signer server certificate.
- `SIGNER_CLIENT_CA_FILE`: CA that issued the MultX API client certificate.
- `SIGNER_POLICY_FILE`: reviewed source-chain and token-route allowlist.
- `SIGNER_STATE_FILE`: persistent decision journal; defaults to
  `/var/lib/multx-signer/signed-releases.jsonl`.

The VPS host should use full-disk encryption, SSH-key-only administration, a
default-deny firewall allowing port 9443 only from the MultX API VPS, offline
encrypted key backup, log shipping and uptime alerts. Validator operators must
not share VPS accounts, private keys or TLS server keys.

Each policy source must set an explicit positive `confirmations` value and a
credential-free HTTPS `rpcUrl`. Every source chain and route must be unique.
The signer fails startup on malformed policy or journal data.

No production policy or key material is included. Bridge contracts and routes
must be populated only after audit approval and mainnet deployment.

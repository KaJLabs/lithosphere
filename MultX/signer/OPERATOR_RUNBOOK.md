# MultX KMS signer operator runbook

This runbook prepares one relay. It does not enable MultX or alter the on-chain
validator set.

## Operator inputs

The AWS administrator creates an `ECC_SECG_P256K1`, `SIGN_VERIFY` KMS key and
returns only its ARN, public key and checksummed EVM address. The VPS operator
locally installs the IAM Roles Anywhere certificate/private key, TLS key,
bearer token, reviewed policy and state directory. No private material is sent
through chat, source control or CI.

## Host preparation

1. Install Docker Engine and Compose; create an unprivileged deployment user.
2. Create root-controlled directories for AWS, TLS, application secrets,
   configuration and signer state. Grant the container UID 1000 only the reads
   it requires and write access only to signer state.
3. Populate the placeholder-only environment and AWS config templates from the
   private infrastructure package.
4. Pin the approved registry digest in Compose. Never deploy a mutable tag.
5. Allow inbound TCP/9443 only from approved coordinator addresses and allow
   outbound HTTPS only to AWS Roles Anywhere, KMS and approved source RPCs.
6. Run the transaction-free verification script, then start the service.

## Acceptance

- `/health` is available without credentials and discloses no identity.
- `/v1/identity` requires the bearer token and reports the KMS-derived expected
  address. If mTLS is configured, the approved client certificate is also
  required.
- No `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, session token, EVM private
  key exists in Compose, environment files or images.
- Invalid routes, confirmations and equivocation are rejected before KMS Sign.
- Restart preserves the journal and its equivocation decisions.

## Incident response

Block ingress, stop the relay, disable the Roles Anywhere profile, preserve the
journal/logs and have bridge governance pause and rotate the validator. Do not
schedule or delete the KMS key until recovery and evidence requirements are
approved. MultX remains disabled until its audit and activation gates pass.

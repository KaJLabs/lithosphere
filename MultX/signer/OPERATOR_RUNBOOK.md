# MultX signer operator runbook

This runbook prepares one independent signer. It does not enable MultX or alter
any on-chain validator set.

## Operator inputs

Each operator independently supplies:

- one dedicated VPS with encrypted storage and current security updates;
- one secp256k1 validator key generated on that operator's trusted system;
- one TLS server certificate/key and the CA certificate that issued the
  coordinator's client certificate;
- one reviewed policy containing only approved source bridges and token routes;
- one encrypted offline backup of the validator key and signing journal.

Only the checksummed validator address, signer URL, TLS certificate metadata and
policy checksum are shared with the coordinator. Never send private keys through
chat, email, source control or CI variables.

## Host preparation

1. Create an unprivileged deployment account and install Docker Engine with the
   Compose plugin.
2. Create operator-controlled directories for secrets, configuration and state.
   The container runs as UID/GID 1000, so grant only that identity read access
   to mounted secrets and read/write access to the state directory.
3. Copy `compose.example.yaml` as `compose.yaml` and `signer.env.example` as
   `signer.env`. Put `SIGNER_PRIVATE_KEY_PATH`, `SIGNER_POLICY_PATH`,
   `SIGNER_TLS_CERT_PATH`, `SIGNER_TLS_KEY_PATH`, `SIGNER_CLIENT_CA_PATH`, and
   `SIGNER_STATE_PATH` in Compose's separate root-readable `.env` file; do not
   commit it.
4. Replace the image placeholder with the independently verified immutable image
   digest from the approved release.
5. Restrict inbound TCP/9443 at the VPS firewall to the coordinator's fixed
   source addresses. SSH must use keys and a separate management allowlist.
6. Start with `docker compose up -d`, confirm container health, then inspect only
   non-sensitive identity and rejection logs.

## Acceptance checks

- `/v1/identity` succeeds only with the approved mTLS client certificate and
  reports the expected validator address.
- An unauthenticated TLS client is rejected.
- A wrong source chain, bridge, token route, event, or insufficient-confirmation
  request is rejected without writing a signing decision.
- Repeating the same approved request returns the same signer identity and a
  valid signature; attempting equivocation for a signed source nonce is rejected.
- Restarting the container preserves the journal and the equivocation decision.
- Restore the encrypted backup onto a clean VPS and repeat the checks.

## Incident response

If compromise or policy drift is suspected, block TCP/9443, stop the signer,
preserve the journal and logs, and notify bridge governance to pause and rotate
the validator set. Do not delete the key or journal until evidence and recovery
requirements are agreed. MultX must remain disabled until the audit and all
operator acceptance records are complete.

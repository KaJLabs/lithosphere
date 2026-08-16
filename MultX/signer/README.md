# MultX independent VPS signer

This service replaces the historical AWS KMS integration. Each bridge
validator operates one hardened signer on a separate VPS and failure domain.
The MultX API connects over TLS 1.3 with a client certificate; the validator
private key never enters the API container or repository.

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
6. records an fsync-backed `(sourceChain, sourceNonce) -> hash` decision before
   signing and rejects equivocation, including after restart; and
7. returns an EIP-191 signature only after those checks pass.

## Required mounted files

- `SIGNER_PRIVATE_KEY_FILE`: validator ECDSA private key, readable only by the
  rootless container user.
- `SIGNER_TLS_CERT_FILE` and `SIGNER_TLS_KEY_FILE`: signer server certificate.
- `SIGNER_CLIENT_CA_FILE`: CA that issued the MultX API client certificate.
- `SIGNER_POLICY_FILE`: reviewed source-chain and token-route allowlist.
- `SIGNER_STATE_FILE`: persistent decision journal; defaults to
  `/var/lib/multx-signer/signed-releases.jsonl`.

The host should use full-disk encryption, SSH-key-only administration, a
default-deny firewall allowing port 9443 only from the MultX API VPS, offline
encrypted key backup, log shipping and uptime alerts. Validator operators must
not share VPS accounts, private keys or TLS server keys.

Each policy source must set an explicit positive `confirmations` value and a
credential-free HTTPS `rpcUrl`. Every source chain and route must be unique.
The signer fails startup on malformed policy or journal data.

No production policy or key material is included. Bridge contracts and routes
must be populated only after audit approval and mainnet deployment.

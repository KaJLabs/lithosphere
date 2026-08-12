# MultX AWS KMS signer relay

Each bridge validator operates one private signer relay on a separate VPS and
failure domain. Its non-exportable secp256k1 key remains in AWS KMS. The relay
uses IAM Roles Anywhere temporary credentials through the standard AWS SDK
credential chain; no permanent AWS access key is accepted or configured. The
MultX API connects over TLS 1.3 and supplies a bearer token. Optional mTLS is a
supported additional control.

For every signing request the relay:

1. validates the configured source chain, bridge, token route and destination;
2. queries its own source-chain RPC;
3. requires the configured confirmation depth;
4. verifies the exact `TokensLocked` event at the supplied block;
5. recomputes the release hash locally;
6. records an fsync-backed `(sourceChain, sourceNonce) -> hash` decision and
   rejects equivocation;
7. asks KMS to sign the locally computed EIP-191 digest; and
8. recovers the signature to the configured public signer address before return.

## Required mounted files

- `AWS_CONFIG_FILE`: shared AWS config using `aws_signing_helper
  credential-process` for the named `AWS_PROFILE`.
- Roles Anywhere certificate and certificate private key: mounted locally for
  the credential helper; never committed or sent to the coordinator.
- `SIGNER_BEARER_TOKEN_FILE`: random bearer token mounted as a file.
- `SIGNER_TLS_CERT_FILE` and `SIGNER_TLS_KEY_FILE`: HTTPS certificate and key.
- `SIGNER_CLIENT_CA_FILE`: optional mTLS client CA.
- `SIGNER_POLICY_FILE`: reviewed source-chain and token-route allowlist.
- `SIGNER_STATE_FILE`: persistent anti-equivocation journal.

The runtime role requires exactly `kms:GetPublicKey` and `kms:Sign` on its one
asymmetric KMS key. It receives no encryption or decryption permission. No production
policy, token, certificate, private key or AWS identifier is included.

# MultX VPS-only signing architecture

## Production topology

- One rootless MultX API/relayer deployment on an isolated application VPS.
- Seven independent signer VPSs, operated in separate accounts and preferably
  separate providers/regions.
- Five-of-seven contract threshold.
- TLS 1.3 mutual authentication between the API and every signer.
- A distinct ECDSA key, TLS server key, policy and persistent equivocation
  journal per signer.
- PostgreSQL, monitoring and backups isolated from validator key custody.

The API contains no AWS SDK, cloud credentials or validator private keys.
Relayer and application secrets are injected through mounted files. In
production, local validator key files and plaintext secret environment values
are rejected.

## Signing protocol

The API sends a versioned structured release attestation to each signer. The
signer independently verifies the source-chain `TokensLocked` event and route
policy, then recomputes the same EIP-191 release hash enforced by
`MultXBridge.releaseTokens`. The API independently recovers the returned
signature and rejects any address other than the configured validator.

The audit candidate binds every signature to the destination chain ID and
destination bridge address in addition to the source event and release fields.
Both bridge implementations, the API, independent signer and relayer recompute
the same domain-bound hash. Cross-destination and cross-contract replay tests
must remain in the frozen audit suite.

## Remaining production gates

- Independent review of this signer protocol and the bridge message domain.
- Independent audit confirmation of the destination-domain binding and replay tests.
- Seven operator-approved VPSs, addresses, mTLS certificates and policies.
- Encrypted offline backups and recovery drills for every signer.
- Deployment contract addresses and token routes after the contract audit.
- Staging fault tests: signer outage, wrong identity, expired certificate,
  reorg/insufficient confirmations, route mismatch and equivocation attempt.

Until these gates pass, `MULTX_ENABLED=false` and all bridge contracts and
signer production policies remain unset.

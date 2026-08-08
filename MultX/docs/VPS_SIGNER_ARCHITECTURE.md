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

The current contract hash does not bind the destination chain or destination
bridge. Therefore signatures could be replayed on another destination contract
that shares the same validator set and token address. This is a known
required-before-mainnet contract change; signer policy alone cannot eliminate
an on-chain replay surface once a valid signature has been released.

## Remaining production gates

- Independent review of this signer protocol and the bridge message domain.
- Bind destination chain and destination bridge into the audited on-chain
  signature domain, with migration and replay tests.
- Seven operator-approved VPSs, addresses, mTLS certificates and policies.
- Encrypted offline backups and recovery drills for every signer.
- Deployment contract addresses and token routes after the contract audit.
- Staging fault tests: signer outage, wrong identity, expired certificate,
  reorg/insufficient confirmations, route mismatch and equivocation attempt.

Until these gates pass, `MULTX_ENABLED=false` and all bridge contracts and
signer production policies remain unset.

# MultX

This directory is the audit-visible source package for the Lithosphere MultX
cross-chain bridge.

## Components

- `contracts/`: bridge, wrapped-token and governance contracts; tests;
  deployment scripts; and testnet deployment manifests.
- `api/`: bridge API, database migrations, event listener, relayer and
  validator-signature services.
- `signer/`: independent VPS validator signer with mTLS, source-event policy
  verification and an equivocation journal.
- `sdk/`: `@litho/multx-sdk` v0.3.0 source, React adapter, presets and tests.
- `web/`: the complete Vite/React application containing the MultX bridge UI.
- `infra/`: testnet-only Compose and legacy Ansible deployment references.
- `docs/`: integration, API, operations, threat-model and audit materials.

## Release state

This is a **production candidate**, not an audited LITHO-mainnet release.
Bridge, Swap and MultX remain disabled on LITHO mainnet 9005. Existing
deployment manifests and network presets are Makalu/Kamet and external-chain
testnet records unless a file explicitly says otherwise.

Do not deploy these contracts to LITHO mainnet or enable the feature flags
until all of the following are recorded in this repository:

1. an independent security audit and remediation review;
2. approved mainnet deployment parameters and governance ownership;
3. immutable mainnet contract-address manifests;
4. validator/relayer key-custody approval;
5. end-to-end staging and production-canary evidence.

No private keys, credentials, signing material or live `.env` files belong in
Git. Use protected GitHub environments or the approved deployment secret
manager.

Current immutable candidate:
[`multx-audit-candidate-v0.5.0-20260809`](https://github.com/KaJLabs/Lithosphere/releases/tag/multx-audit-candidate-v0.5.0-20260809).
See [`docs/MAINNET_DEPLOYMENT_GATES.md`](docs/MAINNET_DEPLOYMENT_GATES.md) for
the fail-closed production sequence and remaining approvals.

## Reproducible checks

```bash
cd MultX/contracts && npm ci && npm test && npm run compile
cd ../sdk && npm ci && npm test && npm run typecheck && npm run build
cd ../api && npm ci && npm test
cd ../signer && npm ci && npm test
cd ../web && npm ci && npm run lint && npm run test:unit && npm run build
```

See `SOURCE_PROVENANCE.md` for the import source and integrity boundary.

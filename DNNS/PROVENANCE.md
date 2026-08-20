# DNNS source provenance

This directory publishes the Lithosphere DNNS application-contract source,
general deployment tooling, and public deployment manifests under
`KaJLabs/Lithosphere`.

The Kamet v0 custom contract sources and deployment metadata originated from
`contracts/dnns/` at commit
`b6669f2aca38f3cb8680e8086920d244c260eeae`. Later public CCIP testnet
deployment manifests were carried forward from the same source history.

The public-release review made tooling-only safety changes without changing
the four custom Solidity contract sources:

- deployment signing accepts only the dedicated `DNNS_DEPLOYER_PRIVATE_KEY`
  and requires `DNNS_DEPLOYMENT_APPROVED=true`;
- CCIP scripts accept a public gateway signer address and never a gateway
  private key;
- new commit/reveal operations use unpredictable in-memory secrets;
- restricted administrative maintenance scripts and operational checklists
  were excluded.

The upstream ENS build-only dependency and advisory treatment are documented
in [`SECURITY.md`](SECURITY.md). Its exact version, registry artifact, and
integrity are enforced before installation.

Public deployment manifests contain only on-chain/public identifiers. This
tree intentionally excludes credentials, secret-manager paths, internal
network inventory, recovery records, and privileged operator procedures.

Publishing this source does not attest that a contract was audited, does not
authorize a deployment, and does not resolve the outstanding DNNS owner choice
between the live Kamet v0 interface and the newer Makalu reference
architecture.

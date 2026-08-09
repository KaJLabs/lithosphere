# MultX dependency triage - 2026-08-09

## Decision

The current audit candidate has no known high or critical findings in any
production dependency tree. CI rejects new high or critical production
dependency findings.

MultX remains disabled for mainnet until the contract audit, remediation,
deployment review, and production canary gates are complete.

## Recorded results

| Package | Total | Low | Moderate | High | Critical | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| API | 0 | 0 | 0 | 0 | 0 | Pass |
| Remote signer | 0 | 0 | 0 | 0 | 0 | Pass |
| SDK | 0 | 0 | 0 | 0 | 0 | Pass |
| Web | 32 | 25 | 7 | 0 | 0 | Accepted for the audit candidate; review transitive wallet, router, and browser-polyfill dependencies before production enablement |
| Contracts, complete development tree | 63 | 26 | 20 | 14 | 3 | Development-toolchain exception described below |
| Contracts, production tree (`npm audit --omit=dev`) | 0 | 0 | 0 | 0 | 0 | Pass |

These results were produced with the committed npm lockfiles on 2026-08-09.

## Contract development-toolchain exception

The contract package is source and build tooling; it has no deployed Node.js
runtime. Its OpenZeppelin compile input, Hardhat, Waffle, Ganache, ethers v5,
and environment loader are therefore declared as development dependencies.
The remaining findings are confined to that legacy development tree.

The findings are not being suppressed or represented as remediated. A forced
upgrade would replace the Hardhat/Waffle/ethers v5 stack and can change the
behavior of historical deployment and verification scripts. Those scripts
must not be used for a mainnet deployment until the deployment path has been
migrated or isolated, reviewed, and tested against the audited bytecode.

## Enforced gates

- API, remote signer, SDK, and web CI fail on any high or critical npm finding.
- Contract CI fails on any high or critical finding in its production tree.
- The complete contract development tree remains visible in this exception
  record and must be reassessed during the audit/toolchain migration.
- MultX Bridge, Swap, Cross-swap, and related UI routes remain fail-closed on
  mainnet until separately approved.

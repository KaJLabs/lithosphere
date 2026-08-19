# MultX audit-candidate bytecode hashes - 2026-08-19

Candidate: `multx-audit-candidate-v0.6.0-20260819`

The three in-scope contracts were compiled from KaJ Labs `main` commit
`2e137040440d333ee586aba527c4fb7172a34e21` with Solidity `0.8.24`, optimizer
enabled, `200` runs, and the Hardhat Paris EVM target. The candidate includes
the duplicate-validator rejection added after v0.5. The reproducible command
is:

```bash
cd MultX/contracts
npm ci
npx hardhat compile --force
npm test
npm run audit:bytecode-hashes
```

The clean run completed with 88 passing Hardhat tests.

| Contract | Creation bytes | Creation SHA-256 | Runtime bytes | Runtime SHA-256 |
| --- | ---: | --- | ---: | --- |
| `MultXBridge` | 8,080 | `98a7e1a0156771c70eb3efa7c8998f7cd64203468d7a6f6279a249c98bfd17f6` | 6,894 | `78806be3e01e7362bcd148dcc3434a6ac1c80c61afe5fbe55fd3895c692f8934` |
| `MultXBridgeDest` | 7,928 | `30c48af4980327f05da152115c5f6e0cc576c091f5cc05ef167b78a9561e1f19` | 6,740 | `6cb1f5e362c62933f3bd27d1037bda2a0ed595aefb5d276016e6a90535be9121` |
| `WrappedLEP100` | 4,716 | `cc97a35314a67abada48c742e3687bba3b1498b48e228c0187b0827371c8165d` | 3,290 | `5ec4e2821731fef7efc0ce106ccf77fb88cd52dfc8f585ee71d7d54225adc07a` |

The hash script also emits Keccak-256 values for EVM-oriented tooling.
Creation hashes cover artifact init code before constructor arguments are
appended. The `WrappedLEP100` runtime artifact contains immutable-reference
placeholders; production verification must link the approved constructor
values and compare finalized deployed runtime bytecode.

These hashes are audit evidence, not deployment authorization. Mainnet
deployment requires the auditor-approved remediation tag, approved constructor
arguments and governance, an immutable deployment manifest, and independent
source/runtime-bytecode verification on every chain.

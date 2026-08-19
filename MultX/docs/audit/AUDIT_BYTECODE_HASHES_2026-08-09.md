# MultX audit-candidate bytecode hashes - 2026-08-09

> Superseded by `AUDIT_BYTECODE_HASHES_2026-08-19.md` and candidate
> `multx-audit-candidate-v0.6.0-20260819`. Retained only as historical evidence;
> do not use these hashes for a new audit or deployment.

Candidate: `multx-audit-candidate-v0.5.0-20260809`

The three in-scope contract sources at the working branch were verified to be
identical to this immutable tag, then compiled with Solidity `0.8.24`, optimizer
enabled, `200` runs, and the Hardhat Paris EVM target. The reproducible command
is:

```bash
cd MultX/contracts
npm ci
npx hardhat compile --force
npm run audit:bytecode-hashes
```

| Contract | Creation bytes | Creation SHA-256 | Runtime bytes | Runtime SHA-256 |
| --- | ---: | --- | ---: | --- |
| `MultXBridge` | 7,788 | `24bc8b1181bcd485632f8ed680f06d2dd6e45d5d1d6ce3e1086f107c01306914` | 6,745 | `6bfdb3d2c8e7ae5f26169ac8c1b982c86eded4dda74a1940cbb3e88093b11cfc` |
| `MultXBridgeDest` | 7,636 | `d0911744b41270ad51f9cafbc12111b05cc6dfb3af2a3eb440b4c2d1cfe1bc7e` | 6,591 | `9d7c3c77172b963a83242f42ef1f93a3ec86097cd1d7fe74d026efccc0b1fcec` |
| `WrappedLEP100` | 4,716 | `846139cd9854182c262299dda283f486c50fdefea2798003561a4422a7a4fb99` | 3,290 | `570d4384ac0259ac708e46cd1f65ea7f9cb7e8e20ce0d699434a37abbdc53d82` |

The script also emits Keccak-256 values for EVM-oriented tooling. Creation
hashes cover the artifact init code before constructor arguments are appended.
The `WrappedLEP100` runtime artifact contains immutable-reference placeholders;
production verification must link the approved constructor values and compare
the finalized deployed runtime, not blindly compare the placeholder hash.

These hashes are evidence for audit kickoff, not deployment authorization. A
mainnet deployment must use the auditor-approved tag, approved constructor
arguments, and an immutable deployment manifest, followed by source/bytecode
verification on every destination chain.

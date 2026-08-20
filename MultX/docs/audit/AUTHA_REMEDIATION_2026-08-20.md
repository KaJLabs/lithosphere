# Autha MultX v0 remediation record

> **Historical v0.5-to-v0.7 remediation record.** Current status and v0.8 work
> are recorded in `AUTHA_V070_REMEDIATION_2026-08-21.md`.

- **Source report:** `client-work/Autha Audits — MultX v0.pdf`
- **Audited candidate:** `multx-audit-candidate-v0.5.0-20260809`
- **Report disposition:** NOT READY FOR MAINNET
- **Remediation status:** engineering candidate; independent fix review pending

This record maps the Autha findings to the post-report source. It is not an
audit approval and does not authorize deployment or activation. MultX remains
disabled until Autha reviews the exact immutable remediation candidate and the
remaining governance/deployment gates pass.

| Finding | Engineering disposition | Evidence |
| --- | --- | --- |
| C-01 wrapped-token administrator mint bypass | Remediated in source | `WrappedLEP100` has one immutable `bridge` minter, no `AccessControl`, no administrator and no bridge replacement function. Contract tests prove non-bridge minting and authority replacement are unavailable. |
| M-01 duplicate validators | Already remediated before this patch | Both constructors and both rotation functions reject duplicates; source and destination tests cover initial and rotated sets. |
| M-02 volatile cursor / skipped DB failures | Remediated in source | Migration `006-durable-event-cursors.sql`; deployment-block cold start; PostgreSQL cursor and block hash; configurable overlap; confirmed-block polling; event rows and cursor commit in one transaction; missing routes and DB failures roll back without advancing. API tests cover all failure paths. |
| M-03 API threshold hard-coded to 2 | Already remediated before this patch | `/bridge/status/:txHash` uses the validated runtime threshold through `getSignaturesRequired()` (or the explicit mock threshold in development). |
| M-04 cap claims and malicious releases | Remediated in source and documentation | The implementation and documentation explicitly use fixed/tumbling 24-hour windows. The configured positive cap now applies independently to lock volume and outbound release/mint volume. Policy must account for a possible near-2x boundary burst. Contract tests cover release exhaustion and unchanged replay state on rejection. |
| L-01 stale six-field hash comments | Remediated | Contract NatSpec, migration comments and browser-side signature sorting use the canonical eight fields including destination chain and bridge. |
| O-01 operator-controlled confirmation depth | Deployment gate strengthened | Production network manifests require explicit deployment start block, confirmation/finality depth and reorg overlap for every chain. Values remain subject to independent approval and signer-policy verification. |
| O-02 rotation invalidates in-flight signatures | Procedure retained | The runbook requires pause, drain/resolve in-flight attestations, rotate, update all signer/coordinator policies, transaction-free verification, bounded smoke test and unpause only after approval. |

## Pre-freeze bytecode evidence

Generated with solc 0.8.24, optimizer enabled, 200 runs. These hashes bind the
engineering worktree only; CI must reproduce them after merge before the final
immutable tag is created.

| Contract | Creation SHA-256 | Runtime SHA-256 |
| --- | --- | --- |
| `MultXBridge` | `6f7797a79eddb004f8da25ee0c51129f771345b2a1d7a5cafe803ab032eb6f2e` | `55544ef95fc0ed404d5f6987787c84e39189c2dd5f5e67ee8f852683d2ba9fac` |
| `MultXBridgeDest` | `29b6b1febfa62f8e31a6c972e3d366f863feb75ffc0da4b3d49f11df6816fc95` | `b2809bd20657262ff2cde891823830a86f7db90a805ee59784e583f615af9c7f` |
| `WrappedLEP100` | `78765cb9e76d04e25e8387e61a99a0b77964672f65ae45984970eec5743063b1` | `c1759ec6871308e53ce50bfce6328ccdb260fad71ffe7164587b9432207fc024` |

## Static-analysis triage

Slither was rerun against the remediation worktree. The remaining reports are
the intentional zero-address path for clearing the pause guardian, timestamp
use for the documented fixed 24-hour cap windows, dependency pragma/style
advisories, a test-mock naming advisory, and an interface-inheritance advisory.
The destination burn path now applies checks-effects-interactions and
`nonReentrant`; the source lock path is also `nonReentrant`. This triage is
supporting evidence only and does not replace Autha's fix review.

## Required independent closure

1. Run the full contract, API, signer, SDK and web gates on a clean checkout.
2. Freeze a new immutable remediation tag and publish source/archive, bytecode
   hashes, test evidence and this mapping.
3. Have Autha review that exact tag and close or reclassify every finding in a
   signed fix-review report.
4. Populate and validate the paused mainnet deployment plan only after the fix
   review. Confirm wrapper immutable bridge bindings, unique 5-of-7 validator
   sets, positive caps, finality policies and durable cursor start blocks.
5. Keep contracts undeployed and signing/Bridge/Swap/MultX features disabled
   until explicit production approval.

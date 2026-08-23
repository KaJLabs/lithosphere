# LITHO L1 security upgrade candidate — 2026-08-22

Status: **prepared for independent review; not approved or deployed**

This candidate addresses the consensus, IBC, transaction-decoding, and integer-safety issues identified during the August 2026 L1 incident review. It preserves LITHO's existing EVM/Cosmos identities and immutable one-billion-token supply rule.

## Pinned source

| Component | Current mainnet | Candidate | Pinned source |
|---|---:|---:|---|
| Evmos application | 20.0.0 | 20.0.0 plus LITHO patches | `eca13ef2521a9ef13c32e80b1b147230bdb155b5` |
| Cosmos SDK | 0.50.9 Evmos fork | 0.50.14 plus reviewed Evmos compatibility patch | `f2e6295b662fdb27ea33da1296c29588ccdaab42` |
| CometBFT | 0.38.12 | 0.38.22 | `260f27f0c538a2a6d59f6e3cc2b04864e948cfc0` |
| IBC-Go | 8.5.1 | 8.7.0 | `53eaba19375dab0145509af101dbce193284ec5d` |
| `cosmossdk.io/math` | 1.3.0 | 1.4.0 | Go module release `v1.4.0` |

The build refuses unexpected Evmos or Cosmos SDK commits, verifies all downloaded Go modules, checks the resolved versions, applies the fixed-supply and compatibility patches, runs regression tests, and inspects dependency versions embedded in the resulting binary.

## Incident-derived invariants

| Invariant | LITHO control and verification |
|---|---|
| One authenticated event causes at most one state transition | IBC packet sequence/acknowledgement state is owned by IBC-Go; MultX remains disabled. Duplicate packet, acknowledgement, and ERC-20 callback behavior must remain in regression tests. |
| Every component derives the same meaning from serialized input | Cosmos SDK 0.50.14 transaction-decoding fixes and IBC-Go 8.7.0 acknowledgement fixes are pinned as one candidate. Mixed candidate dependency sets are prohibited. |
| User metadata cannot alter authenticated-event identity | Event identity must be derived only from authenticated chain/channel/port/sequence and canonical payload fields. MultX metadata cannot participate while MultX is disabled. |
| Invalid or ambiguous serialization fails closed | Updated SDK decoding is mandatory; malformed transaction and IBC inputs must return errors without state writes. |
| Quorum means verified signers | L1 consensus uses CometBFT voting power and verified commit signatures. MultX's validator-set quorum is a separate system and remains disabled pending its audit. |
| Every mint or credit has a provable debit, burn, or lock | Inflation minting is rejected, genesis must total exactly `1000000000000000000000000000ulitho`, and every completed transaction is checked against that cap. Bridge/MultX mint paths remain disabled. |
| Replay protection survives upgrades, reorgs, and restarts | Candidate preserves chain ID `lithosphere_9005-1`, EVM chain ID `9005`, committed IBC state, account sequences, and Comet state. No genesis reset or state copy is permitted during upgrade. |

## Automated gates

The clean build must pass all of the following:

1. `go mod verify` after resolving the pinned graph.
2. Genesis supply below, equal to, and above the cap.
3. Transaction post-handler supply-cap tests.
4. Permanent inflation-disable tests.
5. ERC-20 keeper regression suite.
6. IBC transfer keeper regression suite.
7. Linux binary build and execution sanity check.
8. Embedded dependency inspection and SHA-256 recording.

The integration-test patch only tops up Evmos's synthetic test genesis to the exact LITHO cap. It refuses an already over-cap fixture and does not weaken production validation.

## Deployment gates

No production deployment is authorized by this document. Before deployment, all of these are required:

- Autha receives the candidate source patches, pinned-component manifest, test evidence, and binary checksum and approves the L1 fix review.
- KaJ Labs approves an exact UTC maintenance window and named primary/backup responders.
- The validator signing-state backup and recovery evidence are revalidated offline.
- A production-state clone completes replay/startup and state/query smoke tests with this exact binary.
- Current height, app hash, peer count, validator signing status, total `ulitho` supply, and rollback checkpoint are recorded immediately before the window.
- Bridge, Swap, Faucet, and MultX remain disabled unless separately approved.

Because mainnet currently has one active validator, replacing its binary causes a controlled block-production pause. Do not describe or execute this as a zero-downtime rolling validator upgrade. Upgrade non-signing sentries first; update the validator only inside the approved maintenance window.

## Rollback boundary

The candidate does not intentionally perform a store migration. Retain the previous binary by checksum and a consistent data/signing-state backup. Roll back immediately if the candidate cannot start, reports the wrong chain identity, diverges in app hash, fails to sign, changes total supply unexpectedly, or stops block progression.

Never restore an older `priv_validator_state.json` over a newer signing state. If rollback would require restoring validator signing state, stop and perform the documented double-sign-safe recovery ceremony.

## External approvals still required

1. **Autha:** written L1 candidate/fix-review acceptance.
2. **KaJ Labs:** exact UTC maintenance window and production-canary authorization.
3. **Operations:** named primary and backup responders plus validated backup/rollback evidence.

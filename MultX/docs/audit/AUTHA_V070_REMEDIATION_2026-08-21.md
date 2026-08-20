# Autha MultX v0.7.0 remediation record

- **Source report:** `client-work/Autha Audits — MultX v0.7.0 Security Review (1).pdf`
- **Report disposition:** NOT READY FOR MAINNET
- **Candidate:** v0.8 engineering remediation; immutable tag pending merge and CI
- **Activation:** forbidden; Bridge, Swap and MultX remain disabled

This record maps Autha's v0.7.0 findings to the current source. It is not an
audit approval, fix-review result, deployment authorization, or activation
approval.

| Finding | Engineering remediation | Verification evidence |
| --- | --- | --- |
| H-01 unsupported route poisons cursor | Both bridge contracts require owner-configured `supportedRoutes[token][targetChain]`. The listener writes unmapped events to `bridge_rejected_events`, emits an operator error, continues the range, and commits the durable cursor atomically. | Contract route-rejection tests; API tests place an invalid event first, middle and last in a same-block range, retain later valid events, reprocess after restart, and prove cursor advancement. |
| H-02 hidden validators evade verifier | The transaction-free verifier calls `getValidatorCount()` and `getValidators()`, requires the live count to equal the manifest count of seven, and compares the complete ordered set. | Adversarial 7+1 and 7+5 validator tests fail closed. |
| M-01 source bridge absent from release namespace | The canonical nine-field digest includes `sourceBridge`; `releaseTokens` accepts it explicitly; replay state is keyed by `(sourceChain, sourceBridge, sourceNonce)`; file and DynamoDB anti-equivocation keys include the normalized source bridge. | Contract, API, signer, web and invariant tests cover source-bridge binding and namespaced replay. |
| M-02 mixed release evidence | The v0.8 identity will be created only from the merged, green commit. Source hashes, bytecode hashes and test logs must be regenerated for that exact commit; historical v0.6/v0.7 evidence is not the v0.8 identity. | Pending post-merge CI/tag evidence and Autha fix review. |
| I-01 unsafe token semantics | Source escrow measures the bridge balance before and after `transferFrom` and requires the exact requested amount. This rejects fee-on-transfer behavior. Asset admission must reject rebasing and callback/non-standard assets. Destination assets remain immutable-bridge `WrappedLEP100` tokens. | Fee-on-transfer contract test plus the asset-admission rule below. |
| O-01 finality policy | Confirmation depths remain explicit, independently approved deployment-policy inputs. | Pending final production plan approval; no activation implied. |

## Asset admission rule

Only reviewed, fixed-balance ERC-20/LEP100 assets with standard transfer
semantics may be added. Fee-on-transfer, rebasing, reflection, callback-bearing
or otherwise balance-mutating assets are prohibited. Enabling a token and each
destination route are separate owner-controlled operations, and the paused
post-deployment manifest must list every enabled target chain.

## Pre-merge bytecode evidence

Compiled with solc 0.8.24, optimizer enabled, 200 runs. These hashes identify
the engineering worktree only and must be regenerated from the final immutable
tag before audit handoff.

| Contract | Creation bytes | Creation SHA-256 | Runtime bytes | Runtime SHA-256 |
| --- | ---: | --- | ---: | --- |
| `MultXBridge` | 9,842 | `670f2852505695968d4917481c2df00833e73bead21f73669c8fd090185d1f05` | 8,656 | `b9b47213bc563c767523786951f98c4592266621e6e9bf40a7597f422cc98d54` |
| `MultXBridgeDest` | 9,342 | `8cb7621b534046d4bcf42fb7113bf685e41f7cf669fa423a251ae081045d9f67` | 8,154 | `d9bbcb804c38e9acc9a677d907b4f6de8d800f240794582e2460be4550cd7926` |
| `WrappedLEP100` | 3,723 | `78765cb9e76d04e25e8387e61a99a0b77964672f65ae45984970eec5743063b1` | 2,516 | `c1759ec6871308e53ce50bfce6328ccdb260fad71ffe7164587b9432207fc024` |

Slither analyzed 35 contracts with 101 detectors. The new strict-equality
report is intentional: `received == amount` is the runtime rejection control
for unsafe transfer semantics. Remaining reports are the documented ability
to clear a pause guardian with the zero address, fixed-window timestamp usage,
interface/style advisories, and a mock-only immutability suggestion. No new
untriaged high-severity result was reported.

## Remaining independent gates

1. Merge only after all repository CI and security checks pass.
2. Create a new immutable v0.8 candidate tag from that exact commit.
3. Regenerate source manifest, bytecode hashes, dependency/static-analysis
   outputs and full test logs from a clean checkout of the tag.
4. Obtain Autha's signed fix review for that exact tag and close or formally
   accept every finding.
5. Complete separate governance, deployment, finality, canary and activation
   approvals. Until then, do not deploy or enable MultX.

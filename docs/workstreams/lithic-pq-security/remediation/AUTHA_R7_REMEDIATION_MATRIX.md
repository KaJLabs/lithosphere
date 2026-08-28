# Autha Phase 0 R7 Remediation Matrix

**Input:** Autha Makalu PQ Phase 0 R6 Design Re-Review
**Boundary:** focused design closure only; activation remains forbidden.

| R6 finding | R7 evidence | Disposition |
|---|---|---|
| C01 independent LCE semantic disagreement | Python and independent JavaScript now identically require non-empty profile names, sorted/unique non-empty profile and lifecycle lists, and exact profile/lifecycle ID bijection. New negative vectors cover unsorted, orphan and empty-name states. | Corrected candidate |
| C02 cancellation-window bypass | Consensus-versioned `MIN_CANCELLATION_WINDOW=10` and `MIN_ACTIVATION_DELAY=11` are relative to actual `H_request`. Both independent state machines reject Autha's same-block construction and short-delay variants. | Corrected candidate |
| C03 define mutation not constructible | Define now embeds the complete proposed `RegistryProfileV1` in tag 11, binds its domain commitment/ID/definition height, and atomically creates exactly one EXPERIMENTAL lifecycle entry. Define and multi-profile exact-root vectors agree independently. | Corrected candidate |
| C04 lifecycle prose/reference contradiction | Normal edges are uniformly `EXPERIMENTAL -> ACTIVE`, `ACTIVE -> DEPRECATED`, and `DEPRECATED -> DISABLED`; direct normal disable of EXPERIMENTAL/ACTIVE rejects. Both transition runners cover the accepted and rejected paths. | Corrected candidate |
| C05 replay state undefined | `AUTHORIZATION_SEQUENCE_STATE_V1.md` defines exact consensus KV key/value, initialization, exact-next/atomic increment, failures, snapshots, restart, reorg, historical behavior, upgrades and outer Cosmos/EVM counter independence. Seven Python/JavaScript cases agree. | Corrected candidate |
| H01 profile/lifecycle consistency | Exact one-to-one IDs are enforced during decode, root computation, transition, snapshots and replay; malformed orphan/ordering states reject. | Corrected candidate |
| H02 emergency algorithm agility | Genesis precommits a globally distinct ML-DSA-87 2-of-3 successor. A transaction cannot activate it; exact commitment/height/app-hash consensus migration rules and independent premature/wrong/exact/single-use/historical vectors are fixed. | Corrected candidate |
| H03 per-operation registry validity | A complete define/schedule/cancel/emergency matrix freezes required prior/next state, heights, profile fields, commitments and authority. Object negatives and transition vectors exercise each branch. | Corrected candidate |
| H04 adversarial coverage incomplete | The suite now includes Autha's exact cross-decoder, same-block, orphan-state, define-preimage, lifecycle-conflict, replay, reorg and emergency-successor paths. | Corrected candidate |
| M01 organizational authentication | R7 remains intentionally unsigned. Authenticate only the exact archive after Autha closes the design and KaJ Labs performs the organizational signing ceremony. | External final-freeze gate |
| M02 implementation/dependency clearance | Clean assembled source, SBOM/reachability, reproducible binaries, scans, official PQ KAT/interoperability, Makalu load/adversarial tests and Autha implementation review remain required. | Implementation gate retained |

R7 requests design re-review only. Makalu consensus activation, explorer
positive PQ classification, mainnet deployment and dependency acceptance remain
blocked until their separate gates pass.

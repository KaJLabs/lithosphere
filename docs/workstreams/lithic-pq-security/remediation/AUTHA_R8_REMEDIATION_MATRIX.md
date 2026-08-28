# Autha Phase 0 R8 Remediation Matrix

Status: design re-review candidate, 2026-08-28. This matrix maps every finding
in Autha's R7 review to normative and executable R8 evidence.

| R7 finding | R8 closure | Executable evidence |
|---|---|---|
| C01 authorization subject was not bound to the effected actor/subject | `R8_AUTHORIZATION_AND_STATE_INVARIANTS.md` defines a complete action-to-subject table and requires equality before policy/signature evaluation. | 90 `subject_action_bindings.json` cases cover every signed action and all six key-managed subject kinds; both independent runners and dispatch mismatch tests pass. |
| C02 lifecycle requests carried only the next-policy hash | Registration, rotation, disable and recovery requests now carry the complete proposed `PolicyV1`; the decoder recomputes and compares the policy commitment. | Golden lifecycle objects and missing/mismatched-preimage negatives in `golden.json` and `negative.json`; hash-transition vectors. |
| C03 activation could make a pending change noncancellable indefinitely | Consensus-relative minimum windows, `MAX_PENDING_HORIZON=100000`, and recovery-root cancellation at every height before activation are normative. | 16 authorization state-transition cases in both independent runners. |
| H01 history sequence relations were underspecified | Exact initial and successor equations bind record sequence, state `next_record_sequence`, predecessor, and post-state. | Nine `history_sequences.json` cases in both independent runners. |
| H02 emergency registry action had two competing counters | Action `(0x0004,4)` is an explicit general-sequence-KV exception; its wrapper sequence is the sole counter and advances only on success. | Seven dedicated sole-counter cases reject competing/missing state, replay and gaps; rotation preserves the counter and failures do not consume it. |
| H03 invalid `PolicyV1` values decoded | Version, policy kind, nonempty expression, positive epoch and kind-specific constraints are mandatory local decoder invariants. | Broad golden/negative suite, including zero version/kind/epoch and empty expression. |
| H04 missing sequence counters were created lazily | Counters require an explicit authorized initialization transition; missing state rejects and failed actions never mutate state. | Eight authorization sequence cases in Python and independent JavaScript. |
| H05 provenance order/predecessor was not issuer-authenticated | `ProvenanceStatementV1` places type, domain, commitment, sequence and predecessor under the issuer authorization; envelope values must equal the signed statement. | Provenance golden cases and statement-rewrap/mismatch negatives in both LCE decoders. |
| H06 emergency successor profile need not be ACTIVE | Emergency migration binds the expected registry root and requires the successor ML-DSA-87 profile to be ACTIVE with no conflicting scheduled transition. | Six emergency upgrade cases in both independent runners. |
| M01 dynamic registry/static signature codec boundary | A new algorithm or key/signature width requires a new schema/binary release; registry mutation cannot reinterpret an installed codec. | Normative boundary in `CRYPTO_REGISTRY_AND_PROFILES_V1.md`; frozen registry vectors. |
| M02 validator identifier length conflict | Validator sequence identifiers are uniformly 32 bytes; the obsolete 20-byte form rejects. | Decoder constraints and explicit 20-byte negative vector. |
| M03 release and implementation gates remain open | They remain explicit external gates and are not represented as closed by this design package. | `PACKAGE_SCOPE.md`, handoff exclusions and authentication requirement. |

R8 does not claim implementation acceptance, cryptographic KAT completion,
performance acceptance, Makalu activation, explorer-badge approval, or any
mainnet change. Those remain fail-closed gates after Autha's design decision.

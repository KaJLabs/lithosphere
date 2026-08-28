# PQ Resource Limits V1

**Status:** Phase 0 remediation candidate R8; disabled/non-consensus

These are consensus admission ceilings for the Makalu candidate. Inputs exceeding a limit MUST be rejected before cryptographic verification or unbounded allocation.

| Resource | Limit |
|---|---:|
| LCE1 nesting depth | 8 |
| Fields per object | 64 |
| List items | 128 globally; signatures use 16 |
| SigningPayloadV1 | 4,096 bytes |
| Key registration/rotation payload | 8,192 bytes excluding authorization |
| SignatureEntryV1 | 32,768 bytes |
| AuthorizationV1 total | 131,072 bytes |
| BridgeTransferV1 | 16,384 bytes |
| BridgeInclusionProofV1 | 65,536 bytes |
| Compiler manifest | 65,536 bytes |
| Each provenance/attestation record | 65,536 bytes |
| PQ authorization operations per transaction | 16 |
| PQ verification operations per block | 512 |
| Total PQ public-key bytes per transaction | 32,768 |
| Total PQ signature bytes per transaction | 98,304 |
| Policy nesting depth | 8 |
| Policy nodes | 128 |
| Privileged external dependencies in one manifest | 128 |
| ASCII field | 128 bytes; object schemas may lower only |
| Transparency audit-path siblings | 64 |

The executable LCE decoders enforce the following object-type map immediately
after reading the ten-byte header and before decoding fields:

| Object types | Encoded-byte ceiling |
|---|---:|
| `0x0001` | 4,096 |
| `0x0002`, `0x001c`, `0x010f` | 131,072 |
| `0x0003` | 32,768 |
| `0x0010`-`0x0014`, `0x0017`, `0x001b`, `0x001d` | 8,192 |
| `0x0030` | 16,384 |
| `0x0034`, `0x0046` | 65,536 |
| `0x0100`–`0x0103`, `0x0112`, `0x0113`, `0x0117` | 65,536 |

All other registered objects retain the 1,048,576-byte LCE structural ceiling
but remain subject to their smaller field/list/cardinality and aggregate
admission limits. Object decoding is not transaction admission: after parsing,
the separate authorization/policy admission stage enforces signature count,
crypto operation count, total key/signature bytes, policy depth/node count, and
minimum satisfiable footprint. Both reference runners execute structural,
object-specific semantic, and encoded-object ceiling checks; they do not claim
to perform cryptographic verification or stateful transaction admission.

Profile-specific lengths are exact, not maxima. A ML-DSA-65 signature with any length other than 3,309 bytes is invalid; ML-DSA-87 must be 4,627; SLH-DSA-SHAKE-256s must be 29,792.

Gas is charged before verification from input profile and count. Final gas constants are frozen only after benchmarks on supported x86-64 and ARM64 validator classes. The block operation ceiling remains enforced even if the payer has sufficient gas.

At policy creation/update, validators MUST compute the minimum satisfying
authorization footprint exactly as defined in
`AUTHORIZATION_AND_LITHIC_EFFECT_MODEL_V1.md`. The policy is invalid if any
minimum count or byte total exceeds a ceiling above. Runtime verification repeats
the ordinary input ceilings. A syntactically valid but unsatisfiable policy is
never admitted.

Parsing must be single-pass or bounded, reject oversized length headers before allocation, and never decompress attacker-controlled cryptographic objects. Error responses expose one deterministic consensus error code and do not distinguish secret-dependent verification failures.

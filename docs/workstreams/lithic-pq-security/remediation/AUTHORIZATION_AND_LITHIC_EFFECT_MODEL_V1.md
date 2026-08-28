# Authorization Policy and Lithic Effect Model V1

**Status:** Phase 0 remediation candidate R8; disabled/non-consensus

## 1. Policy objects and commitments

`PolicyV1` type `0x0050`: policy ID (1 `BYTES 32`), version (2 `U64`, non-zero),
subject kind (3 `U8`), subject ID (4 `BYTES`), subject authorization epoch (5
`U64`, non-zero), ordinary root (6 `OBJECT PolicyNodeV1`), recovery root (7
`OBJECT`, optional), activation height (8 `U64`), predecessor policy commitment
(9 `BYTES 64`, zero for first), and minimum authorization footprint (10 `U32`).
Commitment uses hash domain `0x0009`.

Both schema-aware decoders enforce every local invariant before returning a
PolicyV1, including non-zero version/authorization epoch/activation/footprint,
registered subject kind, exact subject-ID length, and the complete recursive
node invariants. Runtime admission separately enforces profile availability,
policy predecessor, and subject-state consistency at execution height.

`PolicyNodeV1` type `0x0051`: numeric node type (1 `U8`), exact parameter object
(2 `OBJECT`), and children (3 `OBJECT_LIST`, present only where required). Node
identity/sort hash uses domain `0x000a`. Children are sorted by full 64-byte node
hash and unique.

## 2. Frozen node and parameter registry

| Node ID | Name | Parameter object | Children |
|---:|---|---|---:|
| `1` | `KEY` | `KeyParamsV1` `0x0052` | 0 |
| `2` | `AND` | `EmptyParamsV1` `0x0053` | 2..16 |
| `3` | `THRESHOLD` | `ThresholdParamsV1` `0x0054` | 1..16 |
| `4` | `TIMELOCK` | `TimelockParamsV1` `0x0055` | exactly 1 |
| `5` | `RATE_LIMIT` | `RateLimitParamsV1` `0x0056` | exactly 1 |

`KeyParamsV1`: profile ID (1 `U16`), signer ID (2 `BYTES 1..64`), key slot (3
`U16`, non-zero), key epoch (4 `U64`, non-zero), key state (5 `U8`, must be
ACTIVE for new authorization), public-key commitment (6 `BYTES 64`).

`EmptyParamsV1` has zero fields.

`ThresholdParamsV1`: threshold `k` (1 `U8`), with `1 <= k <= child count`.

`TimelockParamsV1`: minimum execution height (1 `U64`).

`RateLimitParamsV1`: counter namespace (1 `BYTES 32`), scope (2 `U8`), asset (3
`OBJECT AssetRefV1`), maximum amount (4 `U256`, non-zero), window blocks (5
`U64`, non-zero), anchor height (6 `U64`), and amount extractor (7 `U8`).

Unknown node/parameter types, unexpected fields, wrong cardinality, duplicate
children, unsorted children, generic OR, embedded keys, or scripts fail closed.
Maximum nesting is 8 and total nodes 128.

`HYBRID_AUTH_V1` is exactly `AND(CLASSICAL_BRANCH, PQ_BRANCH)`.
`POST_QUANTUM_AUTH_V1` contains only ACTIVE ML-DSA ordinary keys and an optional
separate SLH-DSA recovery root. Missing verifier, disabled profile, parser error,
or invalid branch makes the entire policy false; there is no fallback.

Every AND or THRESHOLD evaluation counts cryptographically distinct KEY
authorities: each counted descendant MUST have a unique public-key commitment.
One `SignatureEntryV1` and one public-key commitment may satisfy at most one
KEY descendant, including through TIMELOCK or RATE_LIMIT wrappers. Duplicate
authorities make policy creation invalid.

## 3. Deterministic RATE_LIMIT state

Scopes are subject `1`, subject+destination principal `2`, and
subject+contract+method `3`. Amount extractors are transfer amount `1`, contract
call native value `2`, and bridge-transfer amount `3`. Any other action/extractor
combination is invalid at policy creation and evaluation.

The counter key is:

```text
(subject_kind, subject_id, policy_id, policy_version,
 node_hash, counter_namespace, scope_components, asset_ref_hash, window_index)
```

At execution height `H`, `H < anchor_height` fails. Otherwise:

```text
window_index = (H - anchor_height) / window_blocks   // unsigned floor division
next = current_counter + extracted_amount
```

Both values are U256. Arithmetic overflow fails. The node is true only when
`next <= maximum_amount` and its child is true. The counter update and protected
state transition commit atomically; a failed transaction changes neither.
Consensus rollback reverts the counter with the containing block. Time and wall
clock are never inputs. A new policy version has a distinct counter key and may
not inherit/reset prior state except through an explicit governance migration.

Windows are fixed block windows, never rolling periods. Boundaries occur exactly
where `window_index` changes.

## 4. Policy mutation and independent key epochs

Policies are immutable. Registration/rotation requests create one pending
policy and pending authorization epoch without altering the active policy.
Activation atomically installs that pending policy and increments active policy
version and active subject authorization epoch. Cancellation removes pending
state without changing either active counter. Disable and recovery are also
pending mutations; they never change active state until generic mature
activation executes from the complete canonical pending object.
A policy can contain keys at different epochs; every `SignatureEntryV1`
resolves its own tuple. The signing payload commits only to the active policy
version/commitment and active subject authorization epoch, never a pending
policy or one global key epoch.

The state transition must match `PolicyMutationV1` in
`SIGNING_AND_BRIDGE_OBJECTS_V1.md`. Old policies remain available only for
historical validation at their original execution heights.

The canonical `SubjectAuthorizationStateV1`, `PendingAuthorizationMutationV1`,
`KeyStateEntryV1`, `ActivatePendingMutationV1`,
`PermissionlessActionEnvelopeV1`, and lifecycle record in that document are
authoritative for active/pending state. A verifier resolves a policy KEY leaf from actual public
key material in active key state. Proposed-key proof entries resolve only from
the proposed operation object and never from the active policy.

## 5. Satisfiability and minimum footprint

Policy creation/update computes the minimum canonical authorization size before
acceptance. For a KEY leaf, the cost is its exact `SignatureEntryV1` encoded size
using the profile signature length. AND sums every child. THRESHOLD sorts child
minimum costs ascending and sums the cheapest `k`. TIMELOCK and RATE_LIMIT use
their child's cost. The calculation adds exact AuthorizationV1 headers, signing
payload, policy object, object-list framing, and signature entries.

The policy is invalid when its minimum satisfying signature count, crypto
operations, public-key bytes, signature bytes, or total authorization bytes
exceeds `RESOURCE_LIMITS_V1.md`. Thus, for example, an unsatisfiable four-SLH-DSA
threshold cannot be registered under the current transaction budget.

The computed byte minimum is stored in PolicyV1 tag 10 and recomputed by every
validator; mismatch fails closed.

## 6. Protected effects

The Lithic analyzer models at least `WRITE_PROTECTED_STATE`, `TRANSFER_VALUE`,
`MINT`, `BURN`, `CHANGE_AUTHORITY`, `CHANGE_RECOVERY`, `UPGRADE_CODE`, `PAUSE`,
`UNPAUSE`, `EXTERNAL_CALL`, `DELEGATE_OR_DYNAMIC_CALL`,
`NATIVE_PRIVILEGED_CALL`, and `BRIDGE_CREDIT_OR_RELEASE`.

A function is protected if it performs, may perform, or reaches a protected
effect. Caller-controlled branches do not remove conservative effects.

Authority sources include typed Lithic authorization, policy state,
owner/admin/role storage, governance/timelock, upgrade administrators, recovery
and guardian keys, bridge/oracle attestations, native host calls, compatibility
calls, storage-loaded authorities, and externally returned authorities. Display
metadata is never authority.

## 7. Call/effect analysis and classification

The compiler builds an interprocedural call graph and propagates effects and
authority to a fixed point. Dynamic addresses, delegate calls, unresolved
function pointers, reflection, inline/unknown bytecode, or unverified privileged
dependencies produce `UNKNOWN_PRIVILEGED_EFFECT`.

`POST_QUANTUM_AUTH_VERIFIED` requires complete summaries; every protected effect
dominated by the common approved policy check; equally strong recovery,
upgrade, and authority mutation; verified immutable dependencies; no unknown
privileged effects; and a valid provenance/audit/deployment/current-state chain.
Any unknown fails closed.

## 8. Compiler evidence

The compiler manifest commits to parsed AST, resolved symbol table, typed IR,
call graph, effect graph, authority graph, dependency set, policy tree,
compiler/verifier builds, policy satisfiability calculation, and rejection
diagnostics. Independent reproduction must produce identical hashes.

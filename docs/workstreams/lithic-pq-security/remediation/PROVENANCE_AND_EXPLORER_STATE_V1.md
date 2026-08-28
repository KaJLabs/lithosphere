# Authenticated Provenance, Transparency, and Explorer State V1

**Status:** Phase 0 remediation candidate R8; disabled/non-consensus

## 1. Evidence chain

Positive classification requires:

```text
Consensus ProvenanceRegistry trust root
  -> BuildProvenanceV1
  -> CompilerManifestV1
  -> direct Autha AuditReviewV1
  -> DeploymentAttestationV1
  -> transparency-log inclusion under signed checkpoints
  -> independently verified canonical chain state
```

A digest alone proves integrity, not issuer identity.

## 2. Record objects and hash domains

| Type | Object | Domain ID | Required issuer role |
|---:|---|---:|---|
| `0x0100` | `BuildProvenanceV1` | `0x0030` | BUILD |
| `0x0101` | `CompilerManifestV1` | `0x0031` | COMPILER |
| `0x0102` | `AuditReviewV1` | `0x0032` | AUDITOR |
| `0x0103` | `DeploymentAttestationV1` | `0x0033` | DEPLOYMENT |
| `0x010e` | `ProvenanceStatementV1` | `0x003b` | record-specific |
| `0x010f` | `ProvenanceEnvelopeV1` | `0x0034` | record-specific |
| `0x0110` | `ProvenanceIssuerV1` | n/a | GOVERNANCE |
| `0x0111` | `ProvenanceRegistryStateV1` | `0x0035` | GOVERNANCE |
| `0x0112` | `TransparencyCheckpointV1` | `0x0036` | LOG |
| `0x0113` | `TransparencyInclusionProofV1` | n/a | proof object |
| `0x0115` | `ProvenanceRegistryMutationV1` | `0x0038` | GOVERNANCE |
| `0x0116` | `ProvenanceRegistryTransitionV1` | `0x0039` | GOVERNANCE |
| `0x0117` | `TransparencyConsistencyProofV1` | `0x003a` | proof object |
| `0x0118` | `TransparencyPathHashV1` | n/a | proof element |

### 2.1 Exact record schemas

`BuildProvenanceV1`: issuer sequence (1 `U64`), repository identity (2 `ASCII`),
40-byte lowercase-hex source commit (3 `ASCII`), source-tree commitment (4
`BYTES 64`), dependency-lock commitment (5 `BYTES 64`), patch-set commitment (6
`BYTES 64`), compiler-source commitment (7 `BYTES 64`), compiler-image SHA-256
(8 `BYTES 32`), build-recipe commitment (9 `BYTES 64`), target architecture (10
`ASCII`), runtime-code commitment (11 `BYTES 64`), ABI commitment (12 `BYTES
64`), reproducibility result (13 `U8`: single `1`, two-build match `2`), and
timestamp (14 `U64`, informational).

`CompilerManifestV1`: sequence (1 `U64`), build-envelope commitment (2 `BYTES
64`), runtime-code commitment (3 `BYTES 64`), VM family (4 `U16`), bytecode
version (5 `U16`), security profile (6 `U16`), authorization-policy commitment
(7 `BYTES 64`), AST (8), typed IR (9), effect graph (10), authority graph (11),
and dependency graph (12) commitments (`BYTES 64`); classical path count (13
`U32`), unknown path count (14 `U32`), upgradeability model (15 `U8`), verifier
source commitment (16 `BYTES 64`), verifier image SHA-256 (17 `BYTES 32`),
verifier-result commitment (18 `BYTES 64`), and minimum-policy-footprint result
(19 `U32`).

`AuditReviewV1`: sequence (1 `U64`), audit organization ID (2 `ASCII`), reviewed
build envelope (3 `BYTES 64`), reviewed manifest envelope (4 `BYTES 64`), report
commitment (5 `BYTES 64`), finding-set commitment (6 `BYTES 64`), 40-byte
lowercase-hex remediation commit (7 `ASCII`), fix-review status (8 `U8`: pending
`1`, failed `2`, passed `3`), exclusions commitment (9 `BYTES 64`), and issuance
timestamp (10 `U64`).

`DeploymentAttestationV1`: sequence (1 `U64`), manifest envelope (2 `BYTES 64`),
audit envelope (3 `BYTES 64`), Cosmos chain ID (4 `ASCII`), EVM chain ID (5
`U64`), genesis artifact SHA-256 (6 `BYTES 32`), contract identity (7 `BYTES`,
namespace-exact), creation transaction identity (8 `BYTES 32`), creation height
(9 `U64`), runtime-code commitment (10 `BYTES 64`), LithoVM version (11 `U16`),
CryptoRegistry root (12 `BYTES 64`), registry height (13 `U64`), implementation
(14), admin (15), recovery (16), and dependency-state (17) commitments (`BYTES
64`), and predecessor attestation commitment (18 `BYTES 64`, zero for first).

Every evidence artifact commitment in these records uses domain `0x0050` over
`ArtifactCommitmentV1` and the exact field-to-kind mapping in
`ARTIFACT_AND_ENUM_REGISTRIES_V1.md`. Deployment tags 15, 16, and 17 use domains `0x0051`,
`0x0052`, and `0x0053` over `AdminStateV1`, `RecoveryStateV1`, and
`DependencyStateV1`. Every other 64-byte structured commitment uses its
registered exact typed object; field labels do not authorize raw hashing.

The compiler manifest has its own Provenance action `approve compiler manifest`
(`namespace 0x0006`, action `2`). Audit is action `3`; deployment is action `4`.

## 3. Reproducible authorization envelope

`ProvenanceEnvelopeV1` contains:

| Tag | Wire | Field |
|---:|---|---|
| 1 | U16 | record type |
| 2 | OBJECT | exact canonical record |
| 3 | U16 | record hash-domain ID |
| 4 | BYTES | recomputed record hash, 64 bytes |
| 5 | BYTES | issuer ID |
| 6 | U8 | issuer role |
| 7 | U64 | issuer sequence |
| 8 | BYTES | predecessor envelope commitment, 64 bytes/zero for first |
| 9 | OBJECT | complete `AuthorizationV1` |
| 10 | OBJECT | complete `ProvenanceStatementV1` |

`ProvenanceStatementV1` contains record type (1 `U16`), record domain (2 `U16`),
record commitment (3 `BYTES 64`), issuer sequence (4 `U64`), and predecessor
envelope commitment (5 `BYTES 64`). Envelope tags 1/3/4/7/8 MUST exactly equal
statement tags 1..5.

The authorization's `SigningPayloadV1` MUST use the Provenance namespace and
record-specific action; its subject is the exact registered issuer; its payload
domain is `0x003b` and its payload commitment is the domain hash of the complete
statement. Its policy, policy commitment, policy
version, subject authorization epoch, chain/genesis context, sequence, expiry,
and every signature entry are therefore present and independently reproducible.
The record tag-1 sequence, envelope issuer sequence, statement issuer sequence,
and signing sequence MUST be equal. This authenticates ordering and predecessor
metadata rather than permitting a signed record to be rewrapped.

The envelope commitment is domain `0x0034` over the full envelope. Signatures
are inside AuthorizationV1 but outside the record hash, so no self-reference
exists.

## 4. Direct audit authentication

An `AuditReviewV1` represented as issued by Autha MUST be authorized directly
by a currently or historically valid Autha AUDITOR issuer policy whose trust
root is registered before issuance. A KaJ Labs or publisher signature stating
that Autha approved a digest is not Autha authentication and cannot satisfy
positive classification.

If Autha supplies a detached signature or signed transparency statement, it is
encoded as the complete AuthorizationV1 in the audit envelope. If Autha does not
provide cryptographic authentication, the explorer status is
`AUDIT_IDENTITY_UNVERIFIED` regardless of report contents.

## 5. ProvenanceRegistry

Issuer roles: BUILD `1`, COMPILER `2`, AUDITOR `3`, DEPLOYMENT `4`, LOG `5`,
GOVERNANCE `6`.

`ProvenanceIssuerV1`: issuer ID (1 `BYTES 32`), role (2 `U8`), policy
commitment (3 `BYTES 64`), policy version (4 `U64`), authorization epoch (5
`U64`), activation height (6 `U64`), revocation height (7 `U64`, zero if none),
predecessor issuer commitment (8 `BYTES 64`, zero if first).
Its issuer commitment is domain `0x0037` over the complete object; therefore a
predecessor value has one unambiguous preimage algorithm.

`ProvenanceRegistryStateV1`: sequence (1 `U64`), issuers (2 `OBJECT_LIST`,
sorted unique by `(role, issuer_id)`), prior state root (3 `BYTES 64`), and
governance-policy commitment (4 `BYTES 64`). Root uses domain `0x0035`.

`ProvenanceRegistryMutationV1`: mutation sequence (1 `U64`), prior registry root
(2 `BYTES 64`), operation (3 `U8`: add `1`, rotate `2`, revoke `3`), target role
(4 `U8`), target issuer ID (5 `BYTES 32`), expected prior issuer commitment (6
`BYTES 64`, zero only for add), proposed issuer (7 `OBJECT ProvenanceIssuerV1`,
required for add/rotate and absent for revoke), effective height (8 `U64`),
governance sequence (9 `U64`), proposed issuer authorization-state commitment
(10 `BYTES 64`, required for add/rotate and absent for revoke), and completed
key-lifecycle-record commitment (11 `BYTES 64`, required for rotate and zero
only for an add whose initial policy was established by the registered issuer
ceremony). Domain `0x0038` is the mutation commitment.

Validation is exact: add requires no existing `(role, issuer_id)`, zero tag 6,
policy version and authorization epoch exactly `1`, and an authenticated issuer
state matching tags 3..5 of the proposed issuer. Rotate requires an ACTIVE
existing issuer matching tag 6, the same role and issuer ID, non-zero
predecessor equal to tag 6, policy version exactly prior+1, authorization epoch
exactly prior+1, and activation height exactly the mutation effective height.
Before governance may authorize the mutation, a standard `KeyRotationV1` for
subject kind provenance issuer `6` MUST have completed. Tag 10 MUST identify
its resulting active `SubjectAuthorizationStateV1`, tag 11 MUST identify the
appended `KeyLifecycleRecordV1`, and those state objects MUST prove old-policy
authorization plus the exact proposed-key kind-2 PoP. The proposed issuer's
policy commitment/version/epoch MUST equal that active state. This completed
transition is consensus state and cannot be substituted with a transaction-
history lookup or an unenforceable prose PoP. Revoke requires an ACTIVE existing
issuer matching tag 6, no tags 7/10/11, and an effective height not earlier than
commit height. Unknown operations, counter values, or role/ID changes fail
closed.

The deterministic transition copies the current state, applies exactly one
mutation, increments state sequence, sets prior state root, sorts issuers by
`(role, issuer_id)`, rejects duplicates, and computes the new state-only root.
Governance then authorizes the exact prior root, new root, and mutation
commitment.

Mutation tag 1 MUST equal the prior registry sequence plus one. The new registry
state sequence and `ProvenanceRegistryTransitionV1.transition_sequence` MUST
both equal mutation tag 1. Overflow or mismatch fails closed, and the record is
appended atomically with the state transition.

`ProvenanceRegistryTransitionV1`: transition sequence (1 `U64`), mutation (2
`OBJECT ProvenanceRegistryMutationV1`), prior registry root (3 `BYTES 64`), new
registry root (4 `BYTES 64`), mutation signing-payload commitment (5 `BYTES 64`),
authorization-envelope commitment (6 `BYTES 64`), commit height (7 `U64`), and
record time (8 `U64`, informational). Domain `0x0039` identifies the append-only
record, which is outside the state root it declares.

The transition function receives actual consensus height `H` separately.
Mutation tag 9 governance sequence MUST equal the enclosing
`SigningPayloadV1.sequence`; tag 8 effective height is the sole issuer effective
height and MUST equal the proposed issuer activation height for add/rotate. Tag
5 MUST equal domain `0x0001` over that exact signing payload, tag 6 MUST equal
domain `0x0014` over the complete authorization, and transition commit height
MUST equal `H`. No transaction-carried height substitutes for `H`; any duplicate
or commitment mismatch fails closed.

Revocation blocks envelopes at or after the revocation height but preserves
earlier valid history.

Roles are distinct. Issuer ID is the canonical uniqueness key across the whole
state, not `(role, issuer_id)`: one issuer ID cannot appear twice or satisfy
multiple roles. Rotation retains both issuer ID and role, changes only approved
policy/key state, and binds proposed activation height exactly to mutation
effective height.

## 6. Normative transparency log

The log is an append-only ordered Merkle tree using SHA3-512:

```text
empty_root = SHA3-512("LITHO_LOG_EMPTY_V1" || 00)
leaf_hash  = SHA3-512("LITHO_LOG_LEAF_V1" || 00 || envelope_commitment)
node_hash  = SHA3-512("LITHO_LOG_NODE_V1" || 00 || left_64 || right_64)
```

For `n > 1`, split the ordered leaf list at the largest power of two strictly
less than `n`; recursively hash left/right. Leaves are never duplicated or
sorted. This defines one root for every ordered prefix.

`TransparencyCheckpointV1`: log ID (1 `BYTES 32`), tree size (2 `U64`), root
(3 `BYTES 64`), prior checkpoint commitment (4 `BYTES 64`, zero for first),
checkpoint sequence (5 `U64`), observed chain height (6 `U64`), and timestamp (7
`U64`, informational). It is authorized by the registered LOG policy through
Provenance `checkpoint log` action and domain `0x0036`.

`TransparencyInclusionProofV1`: log ID (1), tree size (2), leaf index (3 `U64`,
zero-based and `< tree size`), envelope commitment (4 `BYTES 64`), audit path (5
`OBJECT_LIST` of `MerkleSiblingV1` type `0x0114`), and checkpoint commitment (6
`BYTES 64`). Each sibling contains side (`1` left, `2` right) and 64-byte hash.
The verifier reconstructs the exact checkpoint root and rejects extra/missing
siblings.

For inclusion verification, let `k` be the largest power of two strictly less
than current subtree size `n`. Starting at `(index, n)`, recursively derive the
orientation sequence from leaf to root: if `index < k`, recurse into
`(index,k)` then append right side `2`; otherwise recurse into
`(index-k,n-k)` then append left side `1`. The proof MUST have exactly that
length and orientation sequence. Begin with the registered leaf hash of the
envelope commitment; for side `1` compute `H(sibling,current)`, and for side
`2` compute `H(current,sibling)`. Accept only if the final value equals the
authenticated checkpoint root. Tree size zero, index outside the tree,
extra/missing siblings, wrong orientation, or more than 64 siblings fails
closed. `reference/transparency_inclusion_v1.py` is the executable normative
reference and tests every index across non-power-of-two boundaries through
tree size 1,024.

Checkpoint sequence/tree size MUST strictly increase. A new checkpoint must
prove consistency with the previous prefix. Conflicting signed roots for the
same `(log_id, tree_size)` are cryptographic equivocation and force every
dependent classification to `STALE`, retain both signed proofs, and alert.
Rollback to a smaller tree size is invalid.

### 6.1 Canonical consistency proof

`TransparencyConsistencyProofV1`: log ID (1 `BYTES 32`), old tree size (2
`U64`), new tree size (3 `U64`), old checkpoint commitment (4 `BYTES 64`), new
checkpoint commitment (5 `BYTES 64`), and proof path (6 `OBJECT_LIST` of
`TransparencyPathHashV1` type `0x0118`, 0..64 entries). Each path element has
one field: hash (1 `BYTES 64`). Domain `0x003a` commits to the complete proof.

Both referenced checkpoints must be authenticated for the same log ID and
their sizes must equal tags 2/3. Reject when `old_size > new_size`. For
`old_size == 0`, the path MUST be empty and the old root MUST equal the
registered empty root. For equal non-zero sizes, the path MUST be empty and
the two roots MUST be equal. Otherwise run this exact verifier, where `H(a,b)`
is the registered `LITHO_LOG_NODE_V1` construction and `proof[]` is in supplied
order:

```text
fn = old_size - 1
sn = new_size - 1
while (fn & 1) == 1:
    fn >>= 1
    sn >>= 1
if fn == 0:
    fr = old_root
    sr = old_root
    remaining = proof
else:
    fr = proof[0]
    sr = proof[0]
    remaining = proof[1:]
for c in remaining:
    if (fn & 1) == 1 or fn == sn:
        fr = H(c, fr)
        sr = H(c, sr)
        while fn != 0 and (fn & 1) == 0:
            fn >>= 1
            sn >>= 1
    else:
        sr = H(sr, c)
    fn >>= 1
    sn >>= 1
accept iff sn == 0 and fr == old_root and sr == new_root
```

An empty path in the unequal non-zero case is invalid. Extra elements, a final
non-zero `sn`, wrong root, wrong checkpoint, or more than 64 elements fails
closed. The explorer accepts checkpoint N+1 only together with a valid proof
from its last trusted checkpoint N; a signed predecessor reference alone is
not consistency evidence.

## 7. Explorer verification

The explorer uses an independently operated full node with approved chain/genesis
identity and compares height/hash with a second independent validated node.
Missing evidence, node disagreement, unresolved reorg, registry mismatch,
revocation, log equivocation, or unverifiable dependency fails closed.

The API exposes separately:

- `valid_at_deployment`;
- `currently_compliant`;
- verified height/block hash;
- evidence envelope/checkpoint commitments;
- exact reason codes.

`POST_QUANTUM_AUTH_VERIFIED` requires both Booleans true, direct authenticated
audit evidence with passed status, and current transparency inclusion. Code,
admin, recovery, dependency, registry, or evidence change makes status `STALE`
until a new chain passes.

The verifier journals height/hash and evidence atomically, revalidates its last
checkpoint after restart, rolls back to the last common canonical block on
reorg, and never preserves a positive cache across disagreement.

Explorer status is informational and cannot grant protocol capability.

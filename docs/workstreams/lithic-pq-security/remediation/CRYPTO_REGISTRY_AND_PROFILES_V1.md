# CryptoRegistry and Cryptographic Profiles V1

**Status:** Phase 0 remediation candidate R8; disabled/non-consensus

## 1. Profile/implementation separation

A profile ID binds consensus acceptance semantics, not a library binary.
Implementation source, SBOM, build digest, and reachability evidence are
provenance metadata. Two independent conforming implementations MUST agree.

## 2. Initial profiles

| ID | Name | Normative definition | Exact key/signature bytes |
|---:|---|---|---:|
| `0x0101` | `ML_DSA_65_FIPS204_2024_CORR20260731_V1` | FIPS 204 ML-DSA-65 pure mode, context `LITHO-PQ-AUTH-V1`, frozen corrections | 1952 / 3309 |
| `0x0102` | `ML_DSA_87_FIPS204_2024_CORR20260731_V1` | FIPS 204 ML-DSA-87 pure mode, same correction rules | 2592 / 4627 |
| `0x0201` | `SLH_DSA_SHAKE_256S_FIPS205_2024_V1` | FIPS 205 SLH-DSA-SHAKE-256s pure mode, context `LITHO-PQ-RECOVERY-V1` | 64 / 29792 |
| `0x0301` | `ML_KEM_768_FIPS203_2024_V1` | FIPS 203 ML-KEM-768; key establishment only | profile-defined, not a signature |
| `0x1001` | `SHA3_512_FIPS202_V1` | FIPS 202 SHA3-512 | n/a |
| `0x1002` | `SHA3_256_FIPS202_V1` | FIPS 202 SHA3-256 | n/a |
| `0x8001` | `SECP256K1_EVM_COMPAT_V1` | exact transitional profile below | 33 / 65 |

The NIST publications/correction snapshot and its hashes are frozen in
`evidence/nist/README.md`. A later semantic correction requires a new profile
ID; it never silently changes V1. ML-KEM cannot satisfy authorization.

## 2.1 Frozen secp256k1 compatibility profile

Registered public keys are exactly 33-byte SEC1 compressed secp256k1 points
with prefix `02` or `03`, on curve, non-infinity, and subgroup-valid.

The common 64-byte `SigningRootV1` is transformed exactly as Ethereum personal
signing of a 64-byte message:

```text
digest = Keccak-256(
  19 || ASCII("Ethereum Signed Message:\n64") || SigningRootV1
)
```

The leading byte is `0x19`; no hex-string conversion occurs. Signatures are
exactly 65 bytes `r[32] || s[32] || v[1]`. `r` and `s` are non-zero and less
than curve order; `s` MUST be at most
`0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0`;
`v` MUST be `27` or `28`. EIP-155 transaction-style `v` values and DER are
invalid. Recovery MUST yield the registered public key. The EVM address is the
last 20 bytes of Keccak-256 of the uncompressed `x || y` (64 bytes, no `04`).

This EIP-191 transformation is the profile's signature encoding over an already
domain-separated structured root; it is not a new protocol object commitment.

## 3. Lifecycle

States are `EXPERIMENTAL=1`, `ACTIVE=2`, `DEPRECATED=3`, and `DISABLED=4`.

Allowed transitions:

- `EXPERIMENTAL -> ACTIVE` through normal governance;
- `EXPERIMENTAL -> DISABLED` through emergency governance;
- `ACTIVE -> DEPRECATED` through normal governance;
- `ACTIVE -> DISABLED` through emergency governance;
- `DEPRECATED -> DISABLED` through normal or emergency governance.

No reverse transition exists and disabled IDs are never reused. Experimental
profiles operate only in an isolated Makalu namespace and cannot authorize
production or positive explorer classification.

Historical validation uses the state effective at original execution height.
Deprecation blocks registrations/rotations at its activation height. Disablement
blocks every new authorization at its activation height while retaining
historical verification.

## 4. Acyclic canonical state and mutation model

Object types:

- `0x0040` `RegistryProfileV1`
- `0x0041` `RegistryMutationV1`
- `0x0042` `RegistryProfileStateV1`
- `0x0043` `RegistryTransitionRecordV1`
- `0x0045` `ProfileArtifactV1`
- `0x0046` `RegistryEmergencyAuthorityStateV1`

`RegistryProfileV1`: profile ID (1 `U16`), name (2 `ASCII 1..64`), standard
artifact SHA-256 (3 `BYTES 32`), correction artifact SHA-256 (4 `BYTES 32`, zero
if none), parameters commitment (5 `BYTES 64`), context (6 `BYTES 0..255`),
public-key bytes (7 `U32`), signature/ciphertext bytes (8 `U32`), rejection-rules
commitment (9 `BYTES 64`), official-vector commitment (10 `BYTES 64`), and
definition height (11 `U64`). Lifecycle is not embedded here.

Every parameters, rejection-rules, or official-vector commitment is the
`0x0023` domain hash of a `ProfileArtifactV1`, never a raw or unspecified hash.
`ProfileArtifactV1` contains artifact kind (1 `U16`: parameters `1`, rejection
rules `2`, official vectors `3`), exact artifact SHA-256 (2 `BYTES 32`), exact
byte length (3 `U64`), and media type (4 `ASCII`, 1..64). The exact artifact
bytes are retained in governance evidence and must match both length and
SHA-256 before the wrapper commitment is accepted.

`RegistryProfileStateV1`: state sequence (1 `U64`), profiles (2 sorted unique
`OBJECT_LIST RegistryProfileV1`), lifecycle entries (3 sorted unique
`OBJECT_LIST RegistryLifecycleEntryV1` type `0x0044`), and prior profile root (4
`BYTES 64`, zero at genesis).

Both lists are non-empty and sorted by profile ID. Their profile-ID sequences
MUST be byte-for-byte identical: every profile has exactly one lifecycle entry
and every lifecycle entry has exactly one profile. Decode, root computation,
mutation admission, snapshot import, and replay all enforce this bijection.

`RegistryLifecycleEntryV1`: profile ID (1 `U16`), current state (2 `U8`), state
activation height (3 `U64`), scheduled next state (4 `U8`, zero if none), and
scheduled activation height (5 `U64`, zero if none).

### 4.1 Height-derived effective state and deterministic materialization

The transition function receives actual consensus execution height `H`
separately from all transaction bytes. Effective state is exactly:

```text
effective_state(entry, H) =
  entry.scheduled_next_state
    when entry.scheduled_next_state != 0
     and H >= entry.scheduled_activation_height
  entry.current_state otherwise
```

Authorization and profile-admission checks always use `effective_state(entry,
H)`. Therefore a scheduled transition is effective at the first block whose
height equals the scheduled activation height even if no transaction occurs.
The stored profile-state object and its root intentionally retain the current
state plus schedule until a later mutation touches that entry; no implicit
begin-block root mutation occurs.

Before applying any later mutation to the entry at height `H`, validators first
materialize a matured schedule in the mutation's working copy: set current state
to scheduled next state, set state activation height to the scheduled activation
height, and clear both scheduled fields. The mutation's expected prior lifecycle
MUST equal this effective/materialized state. The prior profile root still
commits to the stored pre-materialization object; the proposed root commits to
the materialized-and-mutated object. This normalization and the requested
mutation form one atomic transition and one transition record.

Cancellation is valid only when `H < scheduled_activation_height`; at the
boundary or later the schedule is effective and cannot be cancelled. Scheduling
a second ordinary transition while another unmatured schedule exists fails
closed. Emergency disable may supersede an unmatured ordinary schedule: it
clears that schedule and installs only the emergency DISABLED schedule. If the
prior schedule has matured, it is materialized first and the emergency edge is
validated from that effective state.

Snapshots retain the exact stored object. Replay at height `h` derives the same
effective state using `h`; historical verification before and after a schedule
boundary therefore does not depend on whether a later block materialized it.

The profile-state root is only:

```text
new_profile_root = SHA3-512(
  "LITHO_CRYPTO_PROFILE_STATE_V1" || 00 || LCE1(new RegistryProfileStateV1)
)
```

No transition record, authorization, governance action, or proposed root occurs
inside `RegistryProfileStateV1`. Therefore this computation is acyclic.

`RegistryMutationV1`: mutation sequence (1 `U64`), prior profile root (2
`BYTES 64`), operation (3 `U8`: define `1`, schedule `2`, cancel schedule `3`,
emergency disable `4`), target profile ID (4 `U16`), expected prior lifecycle
(5 `U8`, zero for define), requested next lifecycle (6 `U8`), scheduling height
(7 `U64`), activation height (8 `U64`), expected-profile commitment (9 `BYTES
64`, zero when unchanged or domain `0x0024` over the exact proposed
`RegistryProfileV1`), governance sequence (10 `U64`), and proposed profile (11
optional `OBJECT RegistryProfileV1`). Its domain hash is mutation ID `0x0021`.

The complete per-operation matrix is normative:

| Operation | Prior | Next | Activation | Tag 9 | Tag 11 | Authority |
|---|---:|---:|---|---|---|---|
| define `1` | `0` | `EXPERIMENTAL` | exactly `H` | exact non-zero commitment of tag 11 | required; ID/definition height match target/`H` | ordinary governance execute |
| schedule `2` | current materialized state | one normal edge | `> H`, respecting normal delay | zero | absent | ordinary governance execute |
| cancel `3` | current state | `0` | `0` | zero | absent | ordinary governance execute |
| emergency disable `4` | current materialized state | `DISABLED` | `> H`, respecting emergency delay | zero | absent | emergency authority only |

All operations require non-zero mutation/governance sequences, non-zero target
profile ID, `scheduling_height == H`, the exact current prior root, and no
undeclared fields. Define atomically inserts tag 11 and an exactly matching
`EXPERIMENTAL` lifecycle entry. It cannot retrieve a profile preimage from
transaction history or external evidence. Schedule permits only
`EXPERIMENTAL -> ACTIVE`, `ACTIVE -> DEPRECATED`, and
`DEPRECATED -> DISABLED`; direct normal disablement of EXPERIMENTAL/ACTIVE is
invalid. Cancel requires an existing unmatured schedule. Emergency disable
permits current EXPERIMENTAL, ACTIVE, or DEPRECATED only.

The deterministic transition algorithm receives actual consensus height `H`
separately and is:

1. verify current root equals mutation prior root;
2. require mutation scheduling height equals `H`, materialize the target's
   matured schedule in the working copy, and verify operation/edge;
3. apply the mutation to that copy of profile state;
4. increment state sequence and set prior profile root;
5. reject unsorted/duplicate lists and require their exact profile-ID
   bijection; no transition sorts transaction input implicitly;
6. compute `new_profile_root` from the new state-only object;
7. authorize a `GovernanceActionV1` that commits to prior root,
   `new_profile_root`, and mutation ID; and
8. after authorization succeeds, append a transition record.

The increment is exact: mutation tag 1 equals prior state sequence plus one,
the new state sequence equals mutation tag 1, and the appended transition
record sequence equals the same value. Overflow or mismatch fails closed.

The duplicated fields are exact invariants. `GovernanceActionV1.governance_sequence`
MUST equal `RegistryMutationV1.governance_sequence` and the enclosing
`SigningPayloadV1.sequence`. `GovernanceActionV1.activation_height` MUST equal
`RegistryMutationV1.activation_height`; its commit height MUST equal `H`; its
mutation commitment MUST equal domain `0x0021` over the exact mutation; and its
prior/proposed roots MUST equal the transition inputs/outputs. Normal registry
mutations use Governance execute action `3`; emergency disable uses action `4`,
target type `2`, and `emergency_flag=true`. Any mismatch fails closed.

`RegistryTransitionRecordV1`: transition sequence (1 `U64`), mutation (2
`OBJECT RegistryMutationV1`), prior profile root (3 `BYTES 64`), new profile
root (4 `BYTES 64`), governance action commitment (5 `BYTES 64`), authorization
envelope commitment (6 `BYTES 64`), commit height (7 `U64`), and record time (8
`U64`, informational). It is append-only history and does not participate in
the root it declares.

## 5. Scheduling and emergency authority

Normal scheduling at height `h` requires activation `>= h + 86400`. Emergency
disable requires activation `>= h + 100` and the first-class independent
`PQ_REGISTRY_EMERGENCY_V1` state below.

`RegistryEmergencyAuthorityStateV1` (`0x0046`): authority ID (1 `BYTES 32`),
active emergency policy (2 `OBJECT PolicyV1`), complete subject authorization
state (3 `OBJECT SubjectAuthorizationStateV1`), next emergency-action sequence
(4 `U64`), prior emergency-authority-state commitment (5 `BYTES 64`, zero only
at genesis), and activation height (6 `U64`). Its commitment is domain `0x0025`
and it is stored by the CryptoRegistry module under the single fixed key
`PQ_REGISTRY_EMERGENCY_V1`.

The authority ID is a non-zero genesis-assigned module identity. Both embedded
objects use subject kind governance `4` and subject ID exactly that authority
ID. Policy version/commitment and authorization epoch MUST match between them.
The active policy has no recovery root and its ordinary root is exactly:

```text
THRESHOLD(2, KEY(A), KEY(B), KEY(C))
```

The three KEY nodes use slots `1`, `2`, and `3`, each at epoch `1` initially,
profile `0x0201` SLH-DSA-SHAKE-256s, ACTIVE state, distinct signer IDs, distinct
public-key commitments, and exact public-key material in the embedded subject
state. None of those commitments may appear in the ordinary governance policy,
any operational profile authority, or an affected profile's issuer/validator
policy. Initialization is part of genesis and has policy version/authorization
epoch `1`, next action sequence `1`, zero predecessor, and activation height
equal to genesis height.

For Governance action `0004/4`, `SigningPayloadV1` tags 7/8 select this exact
governance subject; tags 9-11 select its active policy version, commitment, and
authorization epoch; tag 12 equals the state's next emergency-action sequence.
Successful authorization evaluates only the embedded emergency policy and
atomically increments that sequence. This is the sole authoritative counter for
action `0004/4`; no `AuthorizationSequenceStateV1` entry exists for that tuple.
Ordinary governance policy or key state is
never consulted and cannot count toward the threshold.

An ordinary emergency key rotation uses the standard `KeyRotationV1` lifecycle
against this subject and requires the currently active 2-of-3 emergency policy
plus the new key's kind-2 PoP. All three active keys MUST remain homogeneous in
the authority's current profile (`0x0201` initially, or `0x0102` after the
algorithm-successor migration below). Mixing algorithms inside one threshold
is forbidden. Policy version and authorization epoch each increment by one;
the wrapper records its predecessor commitment and preserves the emergency
action sequence. Historical wrapper/policy/key states remain available by
height.

### 5.1 Precommitted algorithm-diverse successor

Genesis also stores a second complete `RegistryEmergencyAuthorityStateV1`
preimage under fixed key `PQ_REGISTRY_EMERGENCY_SUCCESSOR_V1` and its domain
`0x0025` commitment under
`PQ_REGISTRY_EMERGENCY_SUCCESSOR_COMMITMENT_V1`. The successor has a distinct
authority ID and three distinct ML-DSA-87 (`0x0102`) keys, exact 2-of-3 policy,
independent signer IDs/material, sequence `1`, and no overlap with active
emergency, governance, validator, operational, or issuer authorities. It is
inactive and cannot authorize any action while stored as successor.

If the active emergency algorithm is deprecated, disabled, or considered
broken, migration is possible only through a named consensus binary upgrade;
neither ordinary governance nor signatures from the suspect algorithm can
authorize it. The release fixes the upgrade plan ID, activation height,
pre-upgrade app hash, exact successor commitment, and binary SHA-256. At the
activation height, the deterministic migration:

1. requires the current app hash, exact CryptoRegistry root, and stored successor preimage/commitment;
2. requires the successor to be homogeneous `0x0102`, 2-of-3, distinct and
   globally non-overlapping, and requires profile `0x0102` to be effectively
   ACTIVE at `H` with no scheduled DEPRECATED/DISABLED transition at or before
   `H`;
3. archives the complete old wrapper at height `H-1`;
4. installs the exact precommitted successor as active with activation height
   `H` and its independent sequence unchanged; and
5. removes the successor key so it cannot activate twice.

Any mismatch halts before producing the activation-height application root.
The upgrade uses normal consensus software-upgrade coordination and cannot be
triggered by a transaction. Validators that do not install the exact approved
binary cannot agree on the post-upgrade app hash. After activation, old-profile
signatures fail current authorization while historical verification remains
available at prior heights. A later successor requires a new schema/versioned
upgrade; it cannot be silently substituted.

There is no ordinary-governance or alternate on-chain recovery path. Loss of
two active emergency keys without the exact precommitted successor requires a
new explicitly versioned consensus upgrade and therefore fails closed. The
independent `emergency_authority_upgrade.json` runners cover premature,
commitment-mismatch, exact-height, duplicate, old-key, and historical paths.

Emergency authority may disable `EXPERIMENTAL`, `ACTIVE`, or `DEPRECATED`
profiles. It cannot activate, replace, re-enable, or weaken a profile.

CryptoRegistry lifecycle governance applies only to algorithms whose exact
wire sizes, parsers, verifier, rejection rules, and KAT semantics are already
implemented by the active consensus binary. Introducing a genuinely new
signature algorithm requires a coordinated binary/schema upgrade before its
profile may become ACTIVE; Phase 0 does not dynamically load verifiers.

## 6. Historical availability

Consensus snapshots retain the state root, state-only object, complete mutation
and transition history, definitions, and verifier semantics needed from genesis
through snapshot height. Pruning a binary is allowed only when deterministic
historical verification remains available. An upgrade cannot reinterpret a
historical profile.

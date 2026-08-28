# Signing, Key Lifecycle, and Bridge Objects V1

**Encoding:** LCE1 only
**Status:** Phase 0 remediation candidate R8; disabled/non-consensus

The keywords MUST, MUST NOT, REQUIRED, and MAY are normative. Hashes use
`HASH_DOMAIN_REGISTRY_V1.md`.

## 1. Object identifiers

| Type | Object |
|---:|---|
| `0x0001` | `SigningPayloadV1` |
| `0x0002` | `AuthorizationV1` |
| `0x0003` | `SignatureEntryV1` |
| `0x0004` | `TransferActionV1` |
| `0x0005` | `ContractCallV1` |
| `0x0010` | `KeyRegistrationV1` |
| `0x0011` | `KeyRotationV1` |
| `0x0012` | `CancelPendingMutationV1` |
| `0x0013` | `ClassicalDisableV1` |
| `0x0014` | `RecoveryActionV1` |
| `0x0015` | `PublicKeyMaterialV1` |
| `0x0016` | `PolicyMutationV1` |
| `0x0017` | `ActivatePendingMutationV1` |
| `0x0018` | `SubjectAuthorizationStateV1` |
| `0x0019` | `KeyStateEntryV1` |
| `0x001a` | `KeyLifecycleRecordV1` |
| `0x001b` | `PendingAuthorizationMutationV1` |
| `0x001c` | `PermissionlessActionEnvelopeV1` |
| `0x001d` | `FeePaymentActionV1` |
| `0x001e` | `AuthorizationSequenceKeyV1` |
| `0x001f` | `AuthorizationSequenceStateV1` |
| `0x0020` | `GovernanceActionV1` |
| `0x0030` | `BridgeTransferV1` |
| `0x0031` | `ChainRefV1` |
| `0x0032` | `PrincipalRefV1` |
| `0x0033` | `AssetRefV1` |
| `0x0034` | `BridgeInclusionProofV1` |
| `0x0035` | `BridgeAttestationV1` |
| `0x0036` | `FinalityProfileV1` |

All objects use schema version `1`. Fields are required unless marked optional.

## 2. SigningPayloadV1

| Tag | Wire | Field | Constraint |
|---:|---|---|---|
| 1 | U16 | protocol version | exactly `1` |
| 2 | ASCII | Cosmos chain ID | 1..64 bytes |
| 3 | U64 | EVM chain ID | non-zero |
| 4 | BYTES | genesis identity | exact published genesis artifact SHA-256, 32 bytes |
| 5 | U16 | operation namespace | registered below |
| 6 | U16 | action ID | registered below |
| 7 | U8 | subject kind | registered below |
| 8 | BYTES | subject ID | exact namespace encoding, 1..64 bytes |
| 9 | U64 | authorization policy version | non-zero |
| 10 | BYTES | authorization policy commitment | 64 bytes |
| 11 | U64 | subject authorization epoch | non-zero |
| 12 | U64 | sequence | exact next sequence for subject/action domain |
| 13 | U64 | expiry height | `0` or execution height `<=` expiry |
| 14 | ASCII | fee denomination | 1..32 bytes |
| 15 | U256 | fee amount | base units |
| 16 | U16 | payload hash-domain ID | registered domain ID |
| 17 | BYTES | payload commitment | exact 64-byte domain hash |

Policy version, subject authorization epoch, and individual key epochs are
distinct values:

- policy version identifies the exact immutable policy object;
- subject authorization epoch increments for every accepted policy mutation;
- each signature entry identifies its own independently rotating key epoch.

The signing root is:

```text
SHA3-512("LITHO_SIGNING_ROOT_V1" || 00 || LCE1(SigningPayloadV1))
```

Tag 12 is admitted and advanced only by the canonical consensus state defined
in `AUTHORIZATION_SEQUENCE_STATE_V1.md`. Cosmos account sequence, EVM nonce,
transaction history, and process-local caches are not this counter.

Every signature in one authorization authenticates this identical 64-byte root.

## 3. Registered subjects, namespaces, and actions

Subject kinds: account `1`, validator `2`, contract `3`, governance `4`, bridge
signer `5`, provenance issuer `6`.

| Namespace | Value | Actions |
|---|---:|---|
| Account | `0x0001` | transfer `1`, contract call `2`, fee-pay deterministic trigger `3` |
| Key management | `0x0002` | register `1`, rotate `2`, cancel `3`, disable classical `4`, recover `5`, activate pending `6` |
| Validator administration | `0x0003` | register PQ identity `1`, rotate identity `2`, update metadata `3` |
| Governance | `0x0004` | proposal `1`, vote `2`, execute `3`, emergency registry disable `4` |
| Bridge | `0x0005` | attest event `1`, rotate signer set `2` |
| Provenance | `0x0006` | approve build `1`, approve compiler manifest `2`, approve audit record `3`, approve deployment `4`, rotate issuer `5`, checkpoint log `6` |

Unknown values fail closed.

The complete immutable dispatch from `(namespace, action)` to payload object,
payload domain, and allowed policy root is `AUTHORIZATION_ACTION_REGISTRY_V1.md`.
Validators apply it before signature verification. The independent fields in a
SigningPayloadV1 do not permit an unregistered combination.

## 4. SignatureEntryV1 and public-key commitment

`SignatureEntryV1`:

| Tag | Wire | Field | Constraint |
|---:|---|---|---|
| 1 | U8 | key-reference kind | `1` policy key, `2` proposed-key proof |
| 2 | U16 | key slot | non-zero registered slot |
| 3 | U64 | key epoch | exact epoch for this key only |
| 4 | U16 | algorithm profile ID | valid-at-height profile |
| 5 | BYTES | signer ID | canonical subject identity, 1..64 |
| 6 | BYTES | public-key commitment | 64 bytes |
| 7 | BYTES | signature | exact profile length |

`PublicKeyMaterialV1`: profile ID (tag 1 `U16`), public key (tag 2 `BYTES`,
exact profile length). The public-key commitment is the `0x000b` domain hash of
this object. Raw public-key hashes are forbidden.

Entries MUST be sorted and unique by `(signer_id, key_slot, key_epoch,
profile_id)`. Resolution is determined by key-reference kind:

- kind `1` resolves exclusively from the ACTIVE `KeyStateEntryV1` selected by
  `(subject, slot, epoch, profile_id)` under the active policy/state committed
  by the signing payload;
- kind `2` resolves exclusively from the exact proposed
  `PublicKeyMaterialV1` embedded in the signed `KeyRegistrationV1`,
  `KeyRotationV1`, or `RecoveryActionV1`. The verifier computes domain `0x000b`
  over that exact `PublicKeyMaterialV1` and MUST match `SignatureEntryV1` tag 6.
  The operation's outer profile ID MUST equal the embedded material profile ID.

A kind-2 proof cannot satisfy an ordinary active-policy KEY node. A kind-1
entry cannot prove possession of a proposed key. There is no requirement that
key epochs equal one another or equal the subject authorization epoch.

## 5. AuthorizationV1

| Tag | Wire | Field | Constraint |
|---:|---|---|---|
| 1 | OBJECT | signing payload | `SigningPayloadV1` |
| 2 | OBJECT_LIST | signatures | 1..16 `SignatureEntryV1`, sorted unique |
| 3 | OBJECT | policy | exact `PolicyV1` |

Verification MUST recompute the policy commitment; match policy version,
subject, and activation state; match the current subject authorization epoch;
resolve every entry's independent key tuple; verify the common signing root;
evaluate the policy fail-closed; and atomically increment the subject/action
sequence on success.

## 6. Canonical key and policy lifecycle

Key states are `REGISTERED=1`, `PENDING_ACTIVATION=2`, `CANCELLED=3`,
`ACTIVE=4`, `ROTATED=5`, `DISABLED=6`, and `RECOVERED=7`.

Allowed transitions are:

```text
REGISTERED -> PENDING_ACTIVATION -> ACTIVE -> ROTATED
                  |                   |       |
                  +-> CANCELLED       +------> DISABLED
ACTIVE/ROTATED/DISABLED -> RECOVERED (only through recovery policy)
```

No state moves backward. A `(subject, slot, epoch)` is never reused. A new key
epoch equals one plus the maximum epoch in all historical states for that slot,
or `1` when no history exists. Cancelled epochs remain burned without blocking
later registration or rotation.

Registration and rotation requests change only pending state. They MUST NOT
change the active policy version, active policy commitment, or active subject
authorization epoch. Activation atomically replaces the active policy and
increments its version and authorization epoch. Cancellation removes pending
state without changing the active policy or active authorization epoch.
Disablement and recovery are scheduled pending mutations. Submission changes
only pending state. After the cancellation window and maturity height, anyone
may trigger deterministic activation without supplying subject authority; the
precommitted state/policy must match exactly and activation atomically advances
the active policy version and authorization epoch.

`PolicyMutationV1`: subject kind (1 `U8`), subject ID (2 `BYTES`), operation (3
`U8`, exact registry in `ARTIFACT_AND_ENUM_REGISTRIES_V1.md`), prior policy version (4 `U64`), prior policy commitment (5 `BYTES 64`),
next policy version (6 `U64`, prior+1), next policy commitment (7 `BYTES 64`),
prior authorization epoch (8 `U64`), next authorization epoch (9 `U64`,
prior+1), target slot (10 `U16`), prior key epoch (11 `U64`, zero for first
registration), next key epoch (12 `U64`), activation height (13 `U64`),
cancellation deadline (14 `U64`), operation commitment (15 `BYTES 64`).

`PendingAuthorizationMutationV1` is the complete canonical pending transition
state: operation kind (1 `U8`), operation domain ID (2 `U16`), operation
commitment (3 `BYTES 64`), target slot (4 `U16`), target epoch (5 `U64`),
activation height (6 `U64`), cancellation deadline (7 `U64`), transition type
(8 `U8`), next policy version (9 `U64`), next policy commitment (10 `BYTES
64`), next authorization epoch (11 `U64`), proposed-key commitment (12 `BYTES
64`, all-zero only for classical disable), prior key epoch (13 `U64`, zero only
for first registration), resulting target key state (14 `U8`), and prior key
slot (15 `U16`, zero only for first registration; target slot for rotate/disable;
compromised slot for recovery). Domain
`0x0015` commits to this complete object.

Operation kind, domain, transition type, proposed-key presence, prior epoch,
and resulting state MUST match the immutable lifecycle registry. Activation
height MUST be greater than the cancellation deadline. The next policy version
and authorization epoch MUST each equal their active value plus one. The
operation commitment MUST recompute under the registered operation domain.

`SubjectAuthorizationStateV1` is the canonical state-only account record:
subject kind (1 `U8`), subject ID (2 `BYTES`), active policy version (3 `U64`),
active policy commitment (4 `BYTES 64`), active authorization epoch (5 `U64`),
pending mutation (6 `OBJECT PendingAuthorizationMutationV1`, optional), key
states (7 `OBJECT_LIST KeyStateEntryV1`, sorted unique by `(slot, epoch)`), and
next lifecycle-record sequence (8 `U64`, non-zero). Only
one pending mutation is allowed per subject. Its complete preimage is consensus
state; validators MUST NOT retrieve an operation from transaction history to
decide activation or cancellation.

The complete proposed `PolicyV1` preimage is a required field of every request
that creates pending policy state. Its domain `0x0009` commitment MUST equal the
declared next-policy commitment. Acceptance atomically writes that exact object
to the consensus policy-object store and creates pending state. A pending state
is invalid unless the object exists and matches. Activation reads this consensus
object store, never transaction history, and installs only that exact policy.

`KeyStateEntryV1`: slot (1 `U16`), key epoch (2 `U64`), profile ID (3 `U16`),
actual public-key material (4 `OBJECT PublicKeyMaterialV1`), lifecycle state (5
`U8`), originating operation commitment (6 `BYTES 64`), activation height (7
`U64`, zero before activation), retirement height (8 `U64`, zero while active
or pending), and predecessor key-state commitment (9 `BYTES 64`, zero for the
first slot epoch). The key material, not merely its commitment, is consensus
state required for verification. `(subject, slot, epoch)` is immutable.

`KeyLifecycleRecordV1`: record sequence (1 `U64`), subject-state commitment
before transition (2 `BYTES 64`), operation code (3 `U8`, exact registry in
`ARTIFACT_AND_ENUM_REGISTRIES_V1.md`), operation commitment
(4 `BYTES 64`), subject-state commitment after transition (5 `BYTES 64`),
commit height (6 `U64`), and authorizing envelope commitment (7 `BYTES 64`). It
is append-only history and is outside the state root it declares. Its sequence
MUST equal the prior subject state's tag 8; the resulting state's tag 8 MUST be
exactly one greater. The record and state transition commit atomically.

### 6.1 KeyRegistrationV1

Subject kind (1 `U8`), subject ID (2 `BYTES`), profile ID (3 `U16`), slot (4
`U16`), new epoch (5 `U64`, exactly the monotonic next epoch), public-key material (6 `OBJECT`),
activation height (7 `U64`), cancellation deadline (8 `U64`), next-policy
commitment (9 `BYTES 64`), expected current subject-state commitment (10
`BYTES 64`), and complete proposed policy (11 `OBJECT PolicyV1`). Activation is
after the cancellation deadline.
Current-policy authorization plus proposed-key proof-of-possession is required.
Acceptance adds a `PENDING_ACTIVATION` key and the complete
`PendingAuthorizationMutationV1`; it does not replace the active policy.
The proposed-policy commitment is recomputed from tag 11 before the exact
policy is written atomically to the consensus policy-object store. The resulting pending state is deterministically computed and
recorded in `KeyLifecycleRecordV1`; it is not placed in the request because the
pending state already commits to the request and a reverse commitment would be
cyclic.

For every registration, rotation, disable, and recovery request accepted at
actual execution height `H_request`, the consensus-versioned V1 constants are
`MIN_CANCELLATION_WINDOW=10` blocks, `MIN_ACTIVATION_DELAY=11` blocks, and
`MAX_PENDING_HORIZON=100000` blocks. The request MUST satisfy all four conditions:

```text
cancellation_deadline >= H_request + MIN_CANCELLATION_WINDOW
activation_height > cancellation_deadline
activation_height >= H_request + MIN_ACTIVATION_DELAY
activation_height <= H_request + MAX_PENDING_HORIZON
```

The actual consensus height is never supplied by transaction bytes. Failure of
any condition rejects the request before pending state is written.

### 6.2 KeyRotationV1

Tags 1..4 match registration; prior active epoch (5 `U64`), new epoch (6
`U64`, exactly one greater than the maximum historical slot epoch), new public-key material (7 `OBJECT`), activation height (8 `U64`),
cancellation deadline (9 `U64`), next-policy commitment (10 `BYTES 64`),
expected current subject-state commitment (11 `BYTES 64`), and complete
proposed policy (12 `OBJECT PolicyV1`).
Current-policy authorization plus new-key proof-of-possession is required.
Acceptance creates the complete pending mutation only. The prior ACTIVE key
remains active until activation commits atomically.
The proposed-policy commitment is recomputed from tag 12. The deterministic
result is recorded outside the state root.

### 6.3 ActivatePendingMutationV1

`ActivatePendingMutationV1`: subject kind (1 `U8`), subject ID (2 `BYTES`),
pending-mutation commitment (3 `BYTES 64`), expected current subject-state
commitment (4 `BYTES 64`), and resulting subject-state commitment (6 `BYTES
64`). Tag 5 is unregistered and MUST be rejected. Its domain is `0x000d`.

The transition function receives the actual consensus block execution height
`H` separately from all transaction bytes. It is valid only when the complete
matching pending object exists in current consensus state, `H` is strictly
greater than its cancellation deadline and at least its activation height, and every declared next counter,
policy, key epoch, and result state recomputes. The generic transition branches
only on the registered operation/transition kind:

- registration marks the pending key `ACTIVE`;
- rotation marks the new key `ACTIVE` and the replaced key `ROTATED`;
- classical disable marks the already-active target key `DISABLED` and creates
  no new active key;
- recovery marks the replacement key `ACTIVE` and the compromised key
  `RECOVERED`.

It installs the precommitted next policy, advances both active counters, removes
the complete pending object, verifies tag 6, and appends lifecycle operation
code `6`. No transaction-history lookup or partial activation is permitted.

### 6.4 CancelPendingMutationV1

`CancelPendingMutationV1`: subject kind (1 `U8`), subject ID (2 `BYTES`),
pending-mutation commitment (3 `BYTES 64`), expected current subject-state
commitment (5 `BYTES 64`), and resulting
subject-state commitment (6 `BYTES 64`). It is valid at or before the deadline
for any of registration, rotation, classical disable, or recovery. It requires
one complete current ordinary or separately registered recovery root as defined
by the dispatcher. It marks a proposed registration/rotation/recovery key
`CANCELLED` when one exists, removes the pending object, leaves the active
policy/version/authorization epoch unchanged, and appends lifecycle operation
code `5`. The pending epoch remains burned. Tag 4 is unregistered and MUST be
rejected; replay protection uses only the enclosing `SigningPayloadV1` tag 12
sequence for the key-management cancel action. Ordinary authorization may cancel
at or before the deadline; recovery authorization may cancel at any height
strictly before activation.

### 6.5 ClassicalDisableV1

Subject kind (1), subject ID (2), classical slot (3), classical epoch (4), prior
policy commitment (5), next-policy commitment (6), activation height (7), and
reason commitment (8 `BYTES 64`), cancellation deadline (9 `U64`), expected
current subject-state commitment (10 `BYTES 64`), and complete proposed policy
(11 `OBJECT PolicyV1`). It
requires the recovery policy and creates pending
state containing operation/transition kind `3`, a zero proposed-key commitment,
and resulting target state `DISABLED`. Generic mature activation disables the
already-active target key; it never attempts to activate a nonexistent pending
key. Disabled classical keys remain historical-verification-only.

### 6.6 RecoveryActionV1

Subject kind (1), subject ID (2), current policy version (3), compromised slot
(4), compromised epoch (5), replacement profile ID (6), replacement slot (7),
replacement epoch (8), replacement public-key material (9), activation height
(10), cancellation deadline (11), recovery-case commitment (12 `BYTES 64`), and
next-policy commitment (13 `BYTES 64`), expected current subject-state
commitment (14 `BYTES 64`), and complete proposed policy (15 `OBJECT PolicyV1`).
Recovery authorization plus replacement
proof-of-possession is required. The resulting state embeds a
complete pending mutation of kind `4`, including the replacement-key
commitment. It cannot modify unrelated authority or state and does not change
active state until mature activation.

Classical-only migration is forbidden once its profile is disabled.

For activation, disablement, and recovery, the activation transition recomputes
the entire `SubjectAuthorizationStateV1` commitment before committing. Requests
commit the prior state and deterministically derive the pending result, which is
recorded by the append-only lifecycle record. Cancellation commits both prior
and resulting state roots. Neither path claims an active `PolicyMutationV1`;
that object exists only when mature activation changes the active policy.

The exact construction is normative in
`vectors/authorization_hash_transitions.json`. Independent Python and
JavaScript constructors reproduce complete registration, rotation, classical
disable and recovery branches, including every `SubjectAuthorizationStateV1`,
`PolicyMutationV1`, and `KeyLifecycleRecordV1` byte and domain-separated root.

### 6.7 Permissionless activation and fee authorization

A mature activation always uses two explicit layers.

`FeePaymentActionV1`: fee payer (1 `PrincipalRefV1`, EVM or Lithosphere
account), triggered action domain ID (2 `U16`, exactly `0x000d`), triggered
action commitment (3 `BYTES 64`), maximum fee denomination (4 `ASCII`), and
maximum fee amount (5 `U256`). Domain `0x0017` commits to this object. Its
ordinary `AuthorizationV1` uses Account action `0001/3`, consumes the fee
payer's exact next Account/fee-payer sequence, and MUST bind the same fee
denomination and an amount no greater than the signed maximum.
The authorization subject MUST be account kind `1` with subject ID exactly the
fee-payer principal identity; only principal namespaces `1` and `2` are valid
fee payers.

`PermissionlessActionEnvelopeV1`: deterministic action (1 `OBJECT
ActivatePendingMutationV1`), deterministic action domain (2 `U16`, exactly
`0x000d`), deterministic action commitment (3 `BYTES 64`), fee-payment action
(4 `OBJECT FeePaymentActionV1`), and fee-payer authorization (5 `OBJECT
AuthorizationV1`). Domain `0x0016` commits to the complete envelope for history.

The action and fee commitments are recomputed and cross-checked. The target
account supplies no signature, its authorization policy is not evaluated, and
its action sequence is not consumed. The required fee payer supplies the only
transaction-admission authorization. A signatureless `AuthorizationV1`, an
anonymous transaction, or an authorization using the target's policy as a
placeholder is invalid.

## 7. Ordinary actions and governance

`TransferActionV1`: sender (1 `PrincipalRefV1`), recipient (2), asset (3
`AssetRefV1`), amount (4 `U256`, non-zero), memo commitment (5 `BYTES 64`, zero
means absent). Its payload commitment uses domain `0x0002`.

A non-zero memo commitment is domain `0x0050` over `ArtifactCommitmentV1` with
kind `0x0020`.

`ContractCallV1`: caller (1 `PrincipalRefV1`), contract (2), selector (3 `BYTES
4`), canonical-argument commitment (4 `BYTES 64`), value asset (5
`AssetRefV1`), value amount (6 `U256`), gas limit (7 `U64`, non-zero). Its
payload commitment uses domain `0x0003`.

For transfer and contract-call actions, the signing subject is account kind `1`
and MUST equal the sender/caller principal identity exactly. Key-management
operation subject fields MUST equal the signing subject exactly. All other
state-selected authority bindings follow the immutable R8 subject/action table.

The canonical-argument commitment is domain `0x0050` over an
`ArtifactCommitmentV1` whose kind is `0x0021` canonical contract arguments. Classical
disable reason and recovery-case commitments use domain `0x0056` over
`SecurityReasonV1`. Bridge route-policy commitment uses domain `0x0054` over
`RoutePolicyV1`. `FinalityProfileV1` proof-format commitment uses domain
`0x0055` over `ProofFormatV1`.

`GovernanceActionV1`: governance sequence (1 `U64`), action type (2 `U16`),
target type (3 `U16`), target ID (4 `BYTES`), prior state root (5 `BYTES 64`),
proposed state root (6 `BYTES 64`), mutation commitment (7 `BYTES 64`), commit
height (8 `U64`), activation height (9 `U64`), emergency flag (10 `BOOL`). It
uses domain `0x000c`. Proposed roots are computed from state-only objects and
never from a record containing the proposed root.

Action type MUST equal the outer `SigningPayloadV1.action_id`; target type/ID
and emergency flag MUST satisfy `ARTIFACT_AND_ENUM_REGISTRIES_V1.md`. Actions
`1..3` require ordinary governance and `emergency_flag=false`. Action `4`
requires target type `2`, `emergency_flag=true`, and exclusively the independent
`PQ_REGISTRY_EMERGENCY_V1` 2-of-3 SLH-DSA authority selected by the immutable
dispatcher. Ordinary governance signatures MUST NOT count toward action `4`.

## 8. Canonical chain, principal, and asset identity

`ChainRefV1`: namespace (1 `U8`: Cosmos `1`, EVM `2`, hybrid Cosmos/EVM `3`),
canonical chain ID (2 `ASCII`, 1..64), genesis artifact SHA-256 (3 `BYTES 32`),
EVM chain ID (4 `U64`, zero only for Cosmos-only).

Genesis identity hashes exact published genesis artifact bytes. Whitespace,
line endings, field order, and terminal newline are part of those bytes. The
artifact URL/digest are governance-registered; JSON normalization is forbidden.

| Principal ID | Meaning | Identity bytes |
|---:|---|---|
| 1 | Lithosphere/Cosmos account | exactly 20 raw bytes |
| 2 | EVM externally owned account | exactly 20 bytes |
| 3 | EVM/LithoVM contract/application | exactly 20 bytes |
| 4 | Cosmos module/application | exactly 32-byte module ID |
| 5 | Validator consensus identity | exactly 32-byte consensus-key hash |

`PrincipalRefV1`: namespace (1 `U8`), identity (2 `BYTES`, exact length).

| Asset ID | Meaning | Issuer bytes | Asset ID bytes |
|---:|---|---|---|
| 1 | native denomination | empty | 1..64 printable ASCII denomination |
| 2 | EVM/LEP100 contract | exactly 20-byte contract | empty |
| 3 | IBC denomination | exactly 32-byte path hash | exactly 32-byte base-denom hash |
| 4 | non-fungible class | exactly 20 or 32-byte issuer | 1..64 canonical bytes |

`AssetRefV1`: chain (1 `ChainRefV1`), namespace (2 `U8`), issuer (3 `BYTES`),
asset ID (4 `BYTES`), decimals (5 `U8`, `0..38`). Namespace-specific rules are
mandatory. Display strings never determine identity.

When these nested identities require standalone commitments, `ChainRefV1`,
`PrincipalRefV1`, and `AssetRefV1` use domains `0x0057`, `0x0058`, and `0x0059`
respectively. In particular the RATE_LIMIT counter's `asset_ref_hash` is domain
`0x0059`; raw encoding hashes are forbidden.

## 9. Stable bridge identity and finality evidence

`BridgeTransferV1` contains semantic identity only: protocol version (1 `U16`,
`1`), source chain (2), destination chain (3), source application (4),
destination application (5), source asset (6), destination asset (7), amount (8
`U256`, non-zero), sender (9), recipient (10), source transaction identity (11
`BYTES 32`), event/log index (12 `U32`), and source application nonce (13 `U64`,
non-zero).

`BridgeTransferIdV1` is domain `0x0010` over this object. Its full 64 bytes are
the consumed-state key. Re-inclusion of the same transaction/event after a
reorganization produces the same consumed key.

`BridgeInclusionProofV1`: transfer ID (1 `BYTES 64`), source block identity (2
`BYTES 32`), source block height (3 `U64`), source receipt/state root (4 `BYTES
32`), canonical proof bytes (5 `BYTES`, profile-bounded), finality profile ID (6
`U16`), finality checkpoint identity (7 `BYTES 32`), finalized height (8 `U64`),
proof-observed height (9 `U64`). Its commitment uses domain `0x0011`.

`BridgeAttestationV1`: transfer (1 `BridgeTransferV1`), transfer ID (2 `BYTES
64`), inclusion commitment (3 `BYTES 64`), finality profile ID (4 `U16`),
destination bridge code hash (5 `BYTES 32`), route-policy commitment (6 `BYTES
64`). Domain `0x0012` is the exact Bridge `attest event` payload commitment.

Validators verify transfer ID, inclusion commitment, approved finality, route,
and code hash before signing. The consumed key is marked before mint/release.
Inclusion evidence may change before finality, but cannot create a new semantic
transfer ID or second credit.

## 10. Protocol finality profiles

`FinalityProfileV1`: profile ID (1 `U16`), source chain (2 `ChainRefV1`),
algorithm (3 `U8`), minimum depth (4 `U64`), checkpoint rule (5 `U8`),
proof-format commitment (6 `BYTES 64`), activation height (7 `U64`), disable
height (8 `U64`, zero until scheduled).

Algorithms are CometBFT commit verification `1`, Ethereum finalized-checkpoint
verification `2`, and governance-approved deterministic depth plus canonical
header ancestry `3`. Algorithm 3 requires non-zero depth and is prohibited where
probabilistic reorg risk has no approved bound.

Finality profiles are consensus-governed route inputs, not environment
variables. A route cannot activate without an exact profile/proof format.

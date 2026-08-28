# R8 Authorization and State Invariants

**Status:** Phase 0 R8 candidate; disabled, unsigned, and non-consensus

This document is the highest-precedence Phase 0 R8 normative delta. It closes
the authorization, lifecycle, sequence, provenance, and migration ambiguities
identified by Autha in its R7 focused review. Any implementation that cannot
enforce every rule below MUST fail closed.

## 1. Authorization subject/action binding

The authorization subject is a resource boundary, not descriptive metadata.
Before policy selection or signature verification, validators MUST apply the
immutable binding below. Byte equality is exact and constant-time where the
implementation permits it.

| Action | Required signing subject | Bound action identity |
|---|---|---|
| Account transfer `0001/1` | account kind `1` | `TransferActionV1.sender.identity`; sender namespace MUST be account `1` or `2` |
| Account call `0001/2` | account kind `1` | `ContractCallV1.caller.identity`; caller namespace MUST be account `1` or `2` |
| Fee payer `0001/3` | account kind `1` | `FeePaymentActionV1.fee_payer.identity`; namespace MUST be `1` or `2` |
| Key register/rotate/cancel/disable/recover `0002/1..5` | operation subject kind and ID | operation `subject_kind` and `subject_id` exactly |
| Governance `0004/1..3` | governance kind `4` | exact registered ordinary-governance authority ID selected from consensus state |
| Emergency registry disable `0004/4` | governance kind `4` | exact `PQ_REGISTRY_EMERGENCY_V1.authority_id` |
| Bridge attest `0005/1` | bridge-signer kind `5` | exact registered bridge-signer authority ID selected from consensus state |
| Provenance build/compiler/audit/deploy/checkpoint `0006/1..4,6` | provenance-issuer kind `6` | exact active issuer ID for the required immutable role |
| Provenance registry mutation `0006/5` | governance kind `4` | exact registered provenance-governance authority ID |

Permissionless activation `0002/6` has no target-subject authorization. Its
separate fee authorization remains bound by Account action `0001/3`.

No action field may select a different account, policy, key state, issuer,
bridge signer, or governance authority after this check. A mismatch is
`SUBJECT_ACTION_MISMATCH`, consumes no replay counter, and changes no state.

## 2. Policy preimage constructibility

Every request that creates a pending policy MUST carry the complete canonical
`PolicyV1` preimage:

- `KeyRegistrationV1` tag 11;
- `KeyRotationV1` tag 12;
- `ClassicalDisableV1` tag 11;
- `RecoveryActionV1` tag 15.

For each request, validators MUST compute:

```text
SHA3-512("LITHO_POLICY_STATE_V1" || 00 || LCE1(proposed_policy))
```

and require exact equality with that request's next-policy commitment. The
policy subject kind/ID, next version, next authorization epoch, predecessor,
and activation height MUST match the request and current subject state.

Admission atomically writes that exact preimage to the consensus policy-object
store keyed by its commitment and writes the pending mutation. A conflicting
preimage for an existing commitment halts. RPC attachments, local databases,
transaction history, and off-chain evidence are never policy inputs.

## 3. Bounded and recoverable pending mutations

The immutable V1 constants are:

```text
MIN_CANCELLATION_WINDOW = 10 blocks
MIN_ACTIVATION_DELAY    = 11 blocks
MAX_PENDING_HORIZON     = 100000 blocks
```

At actual request height `H_request`, every pending request MUST satisfy:

```text
cancellation_deadline >= H_request + MIN_CANCELLATION_WINDOW
activation_height > cancellation_deadline
activation_height >= H_request + MIN_ACTIVATION_DELAY
activation_height <= H_request + MAX_PENDING_HORIZON
```

The ordinary root may cancel through `cancellation_deadline`. A valid recovery
root may cancel at any height strictly before `activation_height`, even after
the ordinary deadline. Mature activation is valid at or after
`activation_height`. Consensus transaction order resolves same-block races.
Only one pending mutation may exist; a second request fails without modifying
the first. These rules prevent an ordinary-key compromise from creating an
irrevocable but practically unactivatable mutation.

## 4. Deterministic history sequences

Every history stream has exactly one consensus counter.

### Key lifecycle

`SubjectAuthorizationStateV1` tag 8 is `next_lifecycle_record_sequence` (`U64`,
non-zero). For an accepted transition:

```text
KeyLifecycleRecordV1.record_sequence = prior_state.next_lifecycle_record_sequence
new_state.next_lifecycle_record_sequence = prior + 1
```

The record's before/after commitments bind states containing the prior and
incremented values. Rejected transitions consume no number.

### CryptoRegistry

For every accepted registry mutation:

```text
RegistryMutationV1.mutation_sequence = old RegistryProfileStateV1.state_sequence + 1
new RegistryProfileStateV1.state_sequence = mutation_sequence
RegistryTransitionRecordV1.transition_sequence = mutation_sequence
```

### ProvenanceRegistry

For every accepted provenance mutation:

```text
ProvenanceRegistryMutationV1.mutation_sequence = old ProvenanceRegistryStateV1.sequence + 1
new ProvenanceRegistryStateV1.sequence = mutation_sequence
ProvenanceRegistryTransitionV1.transition_sequence = mutation_sequence
```

All additions are checked U64 operations. Overflow fails closed. Each record is
appended atomically with its state mutation.

## 5. Replay-state initialization and emergency exception

`AuthorizationSequenceStateV1` is authoritative for every registered signed
action except emergency registry disable `0004/4`. A normal signed action MUST
reject an absent sequence entry with `MISSING_SEQUENCE_STATE`. Entry creation is
an explicit consensus initialization transition in the same transaction that
makes the subject/action eligible; it starts at sequence one and cannot also
execute the newly eligible action.

Emergency action `0004/4` is the sole exception. Its authoritative counter is
`RegistryEmergencyAuthorityStateV1.next_emergency_action_sequence`. No parallel
`AuthorizationSequenceStateV1` entry exists for that tuple. Rotation of the
emergency authority preserves this wrapper counter. Successful emergency action
execution increments it atomically; every failure leaves it unchanged.

## 6. Complete PolicyV1 local validity

Both canonical decoders MUST reject a `PolicyV1` unless all local invariants
hold, including:

- schema version is one and policy version is non-zero;
- subject kind is registered;
- subject ID has the exact registered length: account/contract `20`, validator,
  governance, bridge signer, and provenance issuer `32`;
- subject authorization epoch is non-zero;
- policy ID and predecessor commitment have exact lengths;
- activation height is non-zero;
- minimum authorization footprint is non-zero;
- the complete node-tree invariants and resource limits pass.

Object decoding is not policy activation: registry/profile availability and
state-dependent checks remain mandatory at the execution height.

## 7. Issuer-authenticated provenance ordering

`ProvenanceStatementV1` type `0x010e` contains record type (1 `U16`), record
domain (2 `U16`), record commitment (3 `BYTES 64`), issuer sequence (4 `U64`,
non-zero), and predecessor envelope commitment (5 `BYTES 64`, zero only for the
first issuer statement). Its commitment uses domain `0x003b`
`LITHO_PROVENANCE_STATEMENT_V1`.

`ProvenanceEnvelopeV1` tag 10 MUST carry this exact statement. Envelope tags
1/3/4/7/8 MUST equal statement tags 1..5. The embedded authorization payload
domain MUST be `0x003b` and its payload commitment MUST equal the statement
commitment. The record's own tag-1 sequence, envelope issuer sequence,
statement issuer sequence, and signing sequence MUST be equal. Therefore neither
the predecessor nor ordering metadata can be rewrapped without invalidating the
issuer authorization.

## 8. Emergency successor CryptoRegistry precondition

The fixed binary migration to the precommitted ML-DSA-87 successor additionally
binds the exact CryptoRegistry root at height `H`. It MUST require profile
`0x0102` to have effective state `ACTIVE` at `H` and no scheduled transition to
`DEPRECATED` or `DISABLED` at or before `H`. A missing profile, incompatible
root, disabled/deprecated state, or conflicting schedule halts before the
activation-height application root is produced.

## 9. Algorithm introduction boundary

CryptoRegistry lifecycle governance applies only to profiles whose complete
wire sizes, parsers, verifier, rejection rules, and KAT semantics are implemented
by the active consensus binary. A genuinely new signature algorithm requires a
coordinated binary/schema upgrade before its profile may become ACTIVE. Dynamic
verifier loading is not supported in Phase 0.

## 10. Validator identity

Validator subject kind `2` and `PrincipalRefV1` validator namespace `5` both use
the same exact 32-byte consensus-key hash. Validator-administration actions
remain unregistered and fail closed until a later audited schema enables them.

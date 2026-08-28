# Authorization Sequence State V1

**Status:** Phase 0 R8 remediation candidate; disabled/non-consensus

This document defines the replay counter used by `SigningPayloadV1` tag 12 for
every registered signed action except emergency registry disable `0004/4`.
That action exclusively uses the counter in
`RegistryEmergencyAuthorityStateV1`; no duplicate sequence KV exists. A Cosmos
account sequence, EVM nonce, mempool cache, transaction index, or
application-local counter MUST NOT substitute for either authoritative state.

## 1. Canonical key and value

`AuthorizationSequenceKeyV1` (`0x001e`) contains subject kind (1 `U8`), exact
subject ID (2 `BYTES`), namespace (3 `U16`), and action ID (4 `U16`). Subject
ID lengths are Account/LithoVM `20`, validator/governance/bridge/issuer/module `32`, as
registered for the subject kind. Namespace and action ID are non-zero and MUST
match an immutable row in `AUTHORIZATION_ACTION_REGISTRY_V1.md`.

The consensus KV key is exactly:

```text
SHA3-256("LITHO_AUTH_SEQUENCE_KEY_V1" || 00 || LCE1(AuthorizationSequenceKeyV1))
```

`AuthorizationSequenceStateV1` (`0x001f`) contains the complete key (1
`OBJECT`), exact next sequence (2 `U64`), last committed consensus height (3
`U64`), and predecessor state commitment (4 `BYTES 64`, zero only for the
initial entry). Its state commitment is domain `0x0019`.

## 2. Admission and atomic transition

For every non-emergency registered signed action, validators load the exact key.
An absent entry fails with `MISSING_SEQUENCE_STATE`; action admission MUST NOT
lazily synthesize sequence one. Validators then require:

```text
SigningPayloadV1.sequence == AuthorizationSequenceStateV1.next_sequence
```

On complete action success, and in the same atomic consensus-state write, the
validator increments `next_sequence` by exactly one, records actual execution
height `H`, and commits the prior state in tag 4. Overflow fails closed. A
decode, dispatch, signature, policy, fee, action, or state-transition failure
does not consume a sequence. Two transactions presenting the same sequence
cannot both commit.

Permissionless key activation consumes no target sequence. Its separately
authorized fee payer consumes only the fee payer's Account `0001/3` sequence.
Emergency action `0004/4` uses only the emergency wrapper's independent
sequence. No `AuthorizationSequenceStateV1` entry exists for it. No namespace
or action shares counters implicitly.

## 3. Initialization, restart, reorg, and upgrade

- At the first Makalu Phase 0 activation, every registered subject/action key
  starts at `next_sequence=1`, `last_committed_height=activation_height`, and a
  zero predecessor. No pre-activation prototype transaction is imported.
- A newly registered subject/action key starts at one through an explicit
  initialization transition in the same transaction that makes it eligible for
  future authorization. That transition cannot also execute the action.
- Restart reloads this committed state from the application state root; cache
  contents are never authoritative.
- Reorg/rollback restores the exact sequence state at the selected committed
  application root. Transactions from the abandoned branch may then be
  replayed only if their sequence is exact for the restored branch.
- Snapshot export/import includes every key and value byte-for-byte.
- A protocol or binary upgrade copies all entries unchanged. A schema change
  requires an explicit deterministic migration committed in the upgrade root;
  resetting, renumbering, or deriving from account/EVM counters is forbidden.
- Historical verification loads the sequence state committed at the original
  execution height and never applies current counters retroactively.

Cosmos account sequence and EVM nonce remain independently enforced where the
outer transaction format requires them. Acceptance requires both the outer
counter and this action-domain sequence; agreement between them is not
required and neither can advance the other.

The independent sequence-state runners and `authorization_sequences.json`
exercise explicit initialization, missing-state rejection, exact-next admission,
duplicate replay, gaps, failed-action rollback, restart, reorg rollback,
namespace isolation, and version preservation.

# LCE1 R8 Conformance Vectors

`golden.json` contains 74 byte-exact accepted objects and their derived hashes:
at least one example for every registered object type plus KEY, AND, THRESHOLD,
TIMELOCK, RATE_LIMIT, hybrid/post-quantum authorization, recovery-policy,
pending-authorization, and replay-state variants. `negative.json` contains
1,375 malformed schema/boundary objects that every decoder must reject. It
includes every byte truncation boundary for the two deeply nested transaction
objects plus wire, ASCII, fixed-length, zero-value, optional-field, pending
state, registry bijection/definition, provenance identity, duplicate authority,
and threshold-boundary cases.

`authorization_state_transitions.json` has 16 request/cancel/activate and
governance-authority sequences, including bounded pending horizons and
recovery-root cancellation before activation. `authorization_sequences.json`
has eight explicit initialization, exact-next, duplicate, gap, failure,
restart, reorg, namespace-isolation, and upgrade cases. Missing counters reject.

`subject_action_bindings.json` has 90 accepted and rejected bindings for every
registered signed action and every key-managed subject kind.
`history_sequences.json` has nine exact
record/state/predecessor transitions for key history, provenance, bridge and
registry history. `emergency_action_sequences.json` has seven cases proving the
emergency wrapper is the sole counter, survives authority rotation, increments
only on success, and rejects replay, gaps, absent state and competing state.

`authorization_hash_transitions.json` has four hash-complete registration,
rotation, classical-disable, and recovery lifecycles. Each fixes canonical
request, pending state, cancellation, activation, policy mutation, subject
state, and lifecycle record bytes and commitments.

`registry_lifecycle.json` has 12 exact-root profile definition, multi-profile,
boundary, cancellation, normal disable, emergency, materialization, and
historical cases. `emergency_authority_upgrade.json` has six algorithm-diverse
successor cases covering premature/wrong activation, exact activation, single
use, current authorization, registry-root binding, ACTIVE successor status and
conflicting-schedule rejection.

Run the complete independent suite from the remediation directory:

```bash
python reference/generate_vectors.py
node reference/lce_v1_independent.mjs
python reference/authorization_dispatch_v1.py
python reference/generate_r8_subject_binding_vectors.py
python reference/subject_action_binding_v1.py
node reference/subject_action_binding_v1_independent.mjs
python reference/generate_r8_state_vectors.py
python reference/authorization_state_transition_v1.py
node reference/authorization_state_transition_v1.mjs
python reference/generate_r8_sequence_vectors.py
python reference/authorization_sequence_state_v1.py
node reference/authorization_sequence_state_v1_independent.mjs
python reference/generate_r8_history_sequence_vectors.py
python reference/history_sequence_binding_v1.py
node reference/history_sequence_binding_v1_independent.mjs
python reference/generate_r8_emergency_sequence_vectors.py
python reference/emergency_action_sequence_v1.py
node reference/emergency_action_sequence_v1_independent.mjs
python reference/generate_authorization_hash_vectors.py
node reference/authorization_hash_transition_v1_independent.mjs
python reference/generate_registry_lifecycle_vectors.py
node reference/registry_lifecycle_v1_independent.mjs
python reference/generate_r8_emergency_vectors.py
python reference/emergency_authority_upgrade_v1.py
node reference/emergency_authority_upgrade_v1_independent.mjs
python reference/transparency_consistency_v1.py
python reference/transparency_inclusion_v1.py
```

The Python and JavaScript implementations share no code. They are executable
format/state references, not production cryptographic verifiers; official
algorithm KATs and the assembled implementation remain separate gates.

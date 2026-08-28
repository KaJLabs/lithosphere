# R9 Phase 0 Freeze Evidence

**Status:** Phase 0 R9 candidate; disabled, unsigned, and non-consensus

This focused delta closes the only freeze-quality gap and records the
operational interpretation requested by Autha's R8 design re-review. All R8
rules remain unchanged and normative except where this document adds evidence
or interpretation. No implementation, activation, or production claim follows
from this document.

## 1. Independent authorization dispatcher

`reference/authorization_dispatch_v1_independent.mjs` is an independently
authored JavaScript implementation of the immutable 20-row authorization
dispatcher. It does not import the Python dispatcher or generated table data.
Its self-test independently verifies:

- all 20 namespace/action to payload-type, domain-ID, authority and subject
  binding rows;
- payload-type and domain-ID mismatch rejection;
- byte-exact subject binding and cross-subject rejection;
- governance inner/outer action, emergency flag and target constraints;
- exclusion of permissionless activation from signed authorization dispatch;
- registry-governance sequence, activation and commit-height binding; and
- provenance-governance sequence and commit-height binding.

The Python and JavaScript dispatchers MUST both pass unchanged before Phase 0
design freeze. A disagreement fails closed and blocks freeze.

## 2. Pending-horizon wall-clock interpretation

`MAX_PENDING_HORIZON = 100000` committed blocks is the immutable consensus
bound. For the Makalu Phase 0 target, the documented nominal block interval is
approximately 525 milliseconds, so the intended operational interpretation is
approximately 52,500 seconds, or 14 hours 35 minutes, from admission to the
latest permitted activation height.

This wall-clock value is a planning and recovery-objective interpretation only;
validators MUST NOT use local time or an estimated duration for consensus
admission. A liveness interruption pauses height advancement and therefore may
extend elapsed wall-clock time without weakening recovery-root cancellation,
which remains available at every committed height before activation.

Before activation on any network, change control MUST record that network's
observed block interval and the resulting expected wall-clock horizon. If the
100,000-block horizon does not satisfy the approved recovery objective, the
constant MUST be changed only through a new reviewed schema/binary version;
operators MUST NOT reinterpret the frozen R9 value locally.

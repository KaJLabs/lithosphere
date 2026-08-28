# Authorization Action Registry V1

**Status:** Phase 0 R8 candidate; disabled/non-consensus

This registry is immutable for protocol version 1. Before signature
verification, validators MUST match the exact `(namespace, action, payload
object type, payload domain)` row and select only the listed authority root.
Unknown or mismatched tuples fail closed.

Before policy selection or signature verification, validators MUST also apply
the exact subject/action binding in `R8_AUTHORIZATION_AND_STATE_INVARIANTS.md`.
Payload actors, operation subjects, and state-selected authorities are not
independent from `SigningPayloadV1.subject_kind/subject_id`.

| Namespace/action | Payload object | Domain | Authority evaluation |
|---|---:|---:|---|
| Account transfer `0001/1` | `TransferActionV1 0004` | `0002` | ordinary root only |
| Account call `0001/2` | `ContractCallV1 0005` | `0003` | ordinary root only |
| Account fee payer `0001/3` | `FeePaymentActionV1 001d` | `0017` | fee-payer ordinary root only |
| Key register `0002/1` | `KeyRegistrationV1 0010` | `0004` | ordinary root + kind-2 proposed-key PoP |
| Key rotate `0002/2` | `KeyRotationV1 0011` | `0005` | ordinary root + kind-2 proposed-key PoP |
| Key cancel `0002/3` | `CancelPendingMutationV1 0012` | `0006` | ordinary root **or** recovery root; one complete root must independently pass |
| Key disable `0002/4` | `ClassicalDisableV1 0013` | `0007` | recovery root only |
| Key recover `0002/5` | `RecoveryActionV1 0014` | `0008` | recovery root + kind-2 proposed-key PoP |
| Key activate `0002/6` | `ActivatePendingMutationV1 0017` | `000d` | deterministic subject transition inside `PermissionlessActionEnvelopeV1`; target authority is not evaluated |
| Governance proposal `0004/1` | `GovernanceActionV1 0020` | `000c` | registered governance ordinary root |
| Governance vote `0004/2` | `GovernanceActionV1 0020` | `000c` | registered governance ordinary root |
| Governance execute `0004/3` | `GovernanceActionV1 0020` | `000c` | registered governance ordinary root |
| Emergency registry disable `0004/4` | `GovernanceActionV1 0020` | `000c` | `PQ_REGISTRY_EMERGENCY_V1` only: independent 2-of-3 distinct SLH-DSA-SHAKE-256s recovery roots |
| Bridge attest `0005/1` | `BridgeAttestationV1 0035` | `0012` | bridge-signer ordinary root |
| Provenance build `0006/1` | `BuildProvenanceV1 0100` | `0030` | BUILD issuer ordinary root |
| Provenance compiler `0006/2` | `CompilerManifestV1 0101` | `0031` | COMPILER issuer ordinary root |
| Provenance audit `0006/3` | `AuditReviewV1 0102` | `0032` | AUDITOR issuer ordinary root |
| Provenance deploy `0006/4` | `DeploymentAttestationV1 0103` | `0033` | DEPLOYMENT issuer ordinary root |
| Provenance rotate `0006/5` | `ProvenanceRegistryMutationV1 0115` | `0038` | governance ordinary root plus a referenced, completed issuer key-lifecycle transition when key material changes |
| Provenance checkpoint `0006/6` | `TransparencyCheckpointV1 0112` | `0036` | LOG issuer ordinary root |

Validator-administration and bridge signer-set rotation actions remain
unregistered in R8 and therefore fail closed until dedicated payload objects
and domains are added in a later schema version.

For Governance namespace actions, `GovernanceActionV1.action_type` MUST equal
the outer `SigningPayloadV1.action_id`. Target type/ID and emergency-flag
semantics are fixed in `ARTIFACT_AND_ENUM_REGISTRIES_V1.md`. In particular,
action `0004/4` cannot fall back to, combine with, or count any ordinary
governance authority. A missing or unavailable emergency root fails closed.
Its exact policy, key material, version/epoch, subject identity, sequence, and
historical state resolve only from `RegistryEmergencyAuthorityStateV1` in
`CRYPTO_REGISTRY_AND_PROFILES_V1.md`.

`Key activate 0002/6` is not represented by `AuthorizationV1` for the target
subject. It is the deterministic action in `PermissionlessActionEnvelopeV1`.
The envelope's fee payer separately authorizes Account action `0001/3`, which
binds the exact activation commitment and consumes only the payer's account
sequence. No target signature or target sequence is consumed.

An ordinary-root evaluation cannot inspect or count recovery-root KEY leaves.
A recovery-root evaluation cannot authorize an ordinary action. Kind-2 entries
are excluded from ordinary/recovery threshold counts and prove possession only
for the exact proposed key in the dispatched operation. Each SignatureEntryV1
may satisfy at most one KEY leaf in one policy evaluation.

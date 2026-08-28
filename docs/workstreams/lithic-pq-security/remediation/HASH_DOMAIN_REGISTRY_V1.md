# Immutable Hash Domain Registry V1

**Normative status:** Phase 0 remediation candidate R8

Every structured protocol commitment is:

```text
HASH(domain || 0x00 || LCE1(typed_object))
```

`domain` is the exact case-sensitive ASCII string below. The terminating NUL is
part of the preimage. No undocumented domain, raw object hash, concatenated
variable-length input, or implicit exception is valid.

Unless stated otherwise, `HASH` is FIPS 202 SHA3-512 and the output is 64 bytes.

| ID | Domain | Typed object | Purpose |
|---:|---|---|---|
| `0x0001` | `LITHO_SIGNING_ROOT_V1` | `SigningPayloadV1` | Common authorization root |
| `0x0002` | `LITHO_ACTION_TRANSFER_V1` | `TransferActionV1` | Transfer payload commitment |
| `0x0003` | `LITHO_ACTION_CONTRACT_CALL_V1` | `ContractCallV1` | Contract-call payload commitment |
| `0x0004` | `LITHO_KEY_REGISTRATION_V1` | `KeyRegistrationV1` | Key-registration commitment |
| `0x0005` | `LITHO_KEY_ROTATION_V1` | `KeyRotationV1` | Key-rotation commitment |
| `0x0006` | `LITHO_CANCEL_PENDING_MUTATION_V1` | `CancelPendingMutationV1` | Generic pending-mutation cancellation |
| `0x0007` | `LITHO_CLASSICAL_DISABLE_V1` | `ClassicalDisableV1` | Classical-key disablement |
| `0x0008` | `LITHO_RECOVERY_ACTION_V1` | `RecoveryActionV1` | Recovery commitment |
| `0x0009` | `LITHO_POLICY_STATE_V1` | `PolicyV1` | Authorization-policy commitment |
| `0x000a` | `LITHO_POLICY_NODE_V1` | `PolicyNodeV1` | Sort/identity hash for policy nodes |
| `0x000b` | `LITHO_PUBLIC_KEY_COMMITMENT_V1` | `PublicKeyMaterialV1` | Public-key commitment |
| `0x000c` | `LITHO_GOVERNANCE_ACTION_V1` | `GovernanceActionV1` | Governance payload commitment |
| `0x000d` | `LITHO_ACTIVATE_PENDING_MUTATION_V1` | `ActivatePendingMutationV1` | Generic pending-mutation activation commitment |
| `0x000e` | `LITHO_SUBJECT_AUTH_STATE_V1` | `SubjectAuthorizationStateV1` | Canonical active/pending authorization state |
| `0x000f` | `LITHO_KEY_STATE_ENTRY_V1` | `KeyStateEntryV1` | Canonical registered key state |
| `0x0010` | `LITHO_BRIDGE_TRANSFER_V1` | `BridgeTransferV1` | Stable replay/consumed identity |
| `0x0011` | `LITHO_BRIDGE_INCLUSION_V1` | `BridgeInclusionProofV1` | Canonical inclusion evidence |
| `0x0012` | `LITHO_BRIDGE_ATTESTATION_V1` | `BridgeAttestationV1` | Exact bridge signing payload |
| `0x0013` | `LITHO_KEY_LIFECYCLE_RECORD_V1` | `KeyLifecycleRecordV1` | Append-only key transition record |
| `0x0014` | `LITHO_AUTHORIZATION_ENVELOPE_V1` | `AuthorizationV1` | Authorization history commitment |
| `0x0015` | `LITHO_PENDING_AUTH_MUTATION_V1` | `PendingAuthorizationMutationV1` | Complete canonical pending transition state |
| `0x0016` | `LITHO_PERMISSIONLESS_ACTION_ENVELOPE_V1` | `PermissionlessActionEnvelopeV1` | Fee-paid deterministic trigger envelope |
| `0x0017` | `LITHO_FEE_PAYMENT_ACTION_V1` | `FeePaymentActionV1` | Fee payer binding to a deterministic action |
| `0x0018` | `LITHO_AUTH_SEQUENCE_KEY_V1` | `AuthorizationSequenceKeyV1` | Canonical replay-counter KV key; SHA3-256 output |
| `0x0019` | `LITHO_AUTH_SEQUENCE_STATE_V1` | `AuthorizationSequenceStateV1` | Canonical exact-next replay state |
| `0x0020` | `LITHO_CRYPTO_PROFILE_STATE_V1` | `RegistryProfileStateV1` | Acyclic current profile state root |
| `0x0021` | `LITHO_CRYPTO_REGISTRY_MUTATION_V1` | `RegistryMutationV1` | Registry mutation commitment |
| `0x0022` | `LITHO_CRYPTO_REGISTRY_TRANSITION_V1` | `RegistryTransitionRecordV1` | Append-only transition record hash |
| `0x0023` | `LITHO_PROFILE_ARTIFACT_V1` | `ProfileArtifactV1` | Typed profile parameters/rules/vector artifact |
| `0x0024` | `LITHO_CRYPTO_PROFILE_DEFINITION_V1` | `RegistryProfileV1` | Individual profile commitment |
| `0x0025` | `LITHO_REGISTRY_EMERGENCY_AUTHORITY_STATE_V1` | `RegistryEmergencyAuthorityStateV1` | Exact independent emergency policy, keys, counters, and history |
| `0x0030` | `LITHO_BUILD_PROVENANCE_V1` | `BuildProvenanceV1` | Build evidence record |
| `0x0031` | `LITHO_COMPILER_MANIFEST_V1` | `CompilerManifestV1` | Compiler evidence record |
| `0x0032` | `LITHO_AUDIT_REVIEW_V1` | `AuditReviewV1` | Audit record |
| `0x0033` | `LITHO_DEPLOYMENT_ATTESTATION_V1` | `DeploymentAttestationV1` | Deployment evidence record |
| `0x0034` | `LITHO_PROVENANCE_ENVELOPE_V1` | `ProvenanceEnvelopeV1` | Envelope identity |
| `0x0035` | `LITHO_PROVENANCE_REGISTRY_STATE_V1` | `ProvenanceRegistryStateV1` | Provenance trust-root state |
| `0x0036` | `LITHO_TRANSPARENCY_CHECKPOINT_V1` | `TransparencyCheckpointV1` | Signed log checkpoint |
| `0x0037` | `LITHO_PROVENANCE_ISSUER_V1` | `ProvenanceIssuerV1` | Issuer/predecessor identity |
| `0x0038` | `LITHO_PROVENANCE_REGISTRY_MUTATION_V1` | `ProvenanceRegistryMutationV1` | Issuer-registry mutation |
| `0x0039` | `LITHO_PROVENANCE_REGISTRY_TRANSITION_V1` | `ProvenanceRegistryTransitionV1` | Append-only issuer transition |
| `0x003a` | `LITHO_TRANSPARENCY_CONSISTENCY_V1` | `TransparencyConsistencyProofV1` | Checkpoint-prefix consistency evidence |
| `0x003b` | `LITHO_PROVENANCE_STATEMENT_V1` | `ProvenanceStatementV1` | Issuer-authenticated record ordering and predecessor |
| `0x0040` | `LITHO_FINALITY_PROFILE_V1` | `FinalityProfileV1` | Source-chain finality policy |
| `0x0050` | `LITHO_ARTIFACT_COMMITMENT_V1` | `ArtifactCommitmentV1` | Immutable source/build/report/graph/argument artifact |
| `0x0051` | `LITHO_ADMIN_STATE_V1` | `AdminStateV1` | Canonical deployment administration state |
| `0x0052` | `LITHO_RECOVERY_STATE_V1` | `RecoveryStateV1` | Canonical deployment recovery state |
| `0x0053` | `LITHO_DEPENDENCY_STATE_V1` | `DependencyStateV1` | Canonical dependency/security state |
| `0x0054` | `LITHO_ROUTE_POLICY_V1` | `RoutePolicyV1` | Canonical bridge route policy |
| `0x0055` | `LITHO_PROOF_FORMAT_V1` | `ProofFormatV1` | Canonical finality-proof format |
| `0x0056` | `LITHO_SECURITY_REASON_V1` | `SecurityReasonV1` | Disable/recovery case evidence |
| `0x0057` | `LITHO_CHAIN_REF_V1` | `ChainRefV1` | Canonical chain reference commitment |
| `0x0058` | `LITHO_PRINCIPAL_REF_V1` | `PrincipalRefV1` | Canonical principal reference commitment |
| `0x0059` | `LITHO_ASSET_REF_V1` | `AssetRefV1` | Canonical asset reference commitment |

## Raw-byte inputs

Opaque bytes are first wrapped in a typed object. `PublicKeyMaterialV1`
(`0x0015`) contains profile ID (tag 1 `U16`) and exact public-key bytes (tag 2
`BYTES`). Its commitment uses domain `0x000b`; `SHA3-512(public_key_bytes)` is
forbidden.

External artifact digests explicitly labelled SHA-256 (genesis files,
container images, source documents) hash the exact artifact bytes and are not
protocol object commitments. Their containing LCE1 record supplies type and
context. JSON or text normalization is forbidden.

`ArtifactCommitmentV1` (`0x0060`) wraps every immutable external evidence
artifact: artifact kind (1 `U16`, registered exclusively by
`ARTIFACT_AND_ENUM_REGISTRIES_V1.md`), exact
SHA-256 (2 `BYTES 32`), exact byte length (3 `U64`), media type (4 `ASCII`), and
content identity/URI (5 `ASCII`, optional). Domain `0x0050` produces the
64-byte commitment. Unknown kinds fail closed, and every containing field
requires the exact registered kind. Build source trees, locks, patches, compiler source,
recipes, runtime/ABI, AST/IR/graphs, verifier source/results, audit reports,
findings/exclusions, and canonical call arguments MUST use this wrapper.

Security state is not an opaque artifact. `AdminStateV1` (`0x0061`),
`RecoveryStateV1` (`0x0062`), `DependencyStateV1` (`0x0063`), `RoutePolicyV1`
(`0x0064`), `ProofFormatV1` (`0x0065`), and `SecurityReasonV1` (`0x0066`) use
their dedicated domains. An authorization-envelope history commitment is
domain `0x0014` over complete `AuthorizationV1`; an expected individual profile
commitment is domain `0x0024` over `RegistryProfileV1`.

Exact security-state schemas are:

- `AdminStateV1`: policy commitment (1 `BYTES 64`), policy version (2 `U64`),
  authorization epoch (3 `U64`), upgradeable (4 `BOOL`), and admin principals
  (5 `OBJECT_LIST PrincipalRefV1`, sorted unique by encoded identity).
- `RecoveryStateV1`: recovery-policy commitment (1 `BYTES 64`), policy version
  (2 `U64`), authorization epoch (3 `U64`), activation delay blocks (4 `U64`),
  and recovery principals (5 `OBJECT_LIST PrincipalRefV1`, sorted unique).
- `DependencyStateV1`: dependency-manifest artifact commitment (1 `BYTES 64`),
  SBOM SHA-256 (2 `BYTES 32`), vulnerability-report artifact commitment (3
  `BYTES 64`), unresolved applicability count (4 `U32`), and approved-exception
  artifact commitment (5 `BYTES 64`, zero only when none).
- `RoutePolicyV1`: route ID (1 `BYTES 32`), source/destination chains (2/3
  `ChainRefV1`), source/destination assets (4/5 `AssetRefV1`), maximum amount
  (6 `U256`), finality profile ID (7 `U16`), and bridge code SHA-256 (8 `BYTES
  32`).
- `ProofFormatV1`: format ID (1 `U16`), name (2 `ASCII`), specification artifact
  commitment (3 `BYTES 64`), maximum proof bytes (4 `U32`), and verifier
  artifact commitment (5 `BYTES 64`).
- `SecurityReasonV1`: reason code (1 `U16`), evidence artifact commitment (2
  `BYTES 64`), and expiry height (3 `U64`, zero if permanent).

`RegistryProfileV1` parameter, rejection-rule, and official-vector
commitments MUST each be domain `0x0023` over `ProfileArtifactV1` (`0x0045`):
artifact kind (1 `U16`: parameters `1`, rejection rules `2`, official vectors
`3`), exact artifact SHA-256 (2 `BYTES 32`), exact byte length (3 `U64`), and
media type (4 `ASCII`, 1..64). The containing 64-byte field is the domain hash;
raw artifact SHA-256 remains available inside the wrapper.

The transparency tree constructions are registered fixed-byte exceptions, not
structured-object commitments:

| Construction | Exact preimage |
|---|---|
| empty root | `SHA3-512("LITHO_LOG_EMPTY_V1" || 00)` |
| leaf | `SHA3-512("LITHO_LOG_LEAF_V1" || 00 || envelope_commitment[64])` |
| node | `SHA3-512("LITHO_LOG_NODE_V1" || 00 || left[64] || right[64])` |

No length is implicit: the leaf input is exactly 64 bytes and a node has two
exactly 64-byte inputs. These three constructions may only be used by the
normative transparency algorithms.

## Domain changes

This table is immutable for schema version 1. A semantic or byte change requires
a new object schema version and a new domain string/ID. Unknown domain IDs fail
closed.

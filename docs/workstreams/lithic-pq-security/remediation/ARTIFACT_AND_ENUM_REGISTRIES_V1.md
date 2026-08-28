# Immutable Artifact and Semantic Enum Registries V1

**Status:** Phase 0 R8 candidate; disabled/non-consensus

This document is normative for schema version 1. Every numeric value below has
exactly the assigned meaning. Unknown, zero, reserved, or context-incompatible
values MUST fail closed. An implementation MUST NOT infer a value from a label,
file name, media type, URI, or local enumeration.

## 1. `ARTIFACT_KIND_REGISTRY_V1`

| Value | Artifact kind |
|---:|---|
| `0x0001` | source tree |
| `0x0002` | dependency lock |
| `0x0003` | patch set |
| `0x0004` | compiler source |
| `0x0005` | build recipe |
| `0x0006` | runtime artifact |
| `0x0007` | ABI |
| `0x0008` | AST |
| `0x0009` | typed IR |
| `0x000a` | effect graph |
| `0x000b` | authority graph |
| `0x000c` | dependency graph |
| `0x000d` | verifier source |
| `0x000e` | verifier result |
| `0x000f` | audit report |
| `0x0010` | finding set |
| `0x0011` | audit exclusions |
| `0x0012` | vulnerability report |
| `0x0013` | approved vulnerability exception |
| `0x0020` | user memo |
| `0x0021` | canonical contract-call arguments |

The containing field fixes the required kind:

| Containing object/field | Required kind |
|---|---:|
| `BuildProvenanceV1.source_tree` | `0x0001` |
| `BuildProvenanceV1.dependency_lock` | `0x0002` |
| `BuildProvenanceV1.patch_set` | `0x0003` |
| `BuildProvenanceV1.compiler_source` | `0x0004` |
| `BuildProvenanceV1.build_recipe` | `0x0005` |
| `BuildProvenanceV1.runtime_code` | `0x0006` |
| `BuildProvenanceV1.ABI` | `0x0007` |
| `CompilerManifestV1.AST` | `0x0008` |
| `CompilerManifestV1.typed_IR` | `0x0009` |
| `CompilerManifestV1.effect_graph` | `0x000a` |
| `CompilerManifestV1.authority_graph` | `0x000b` |
| `CompilerManifestV1.dependency_graph` | `0x000c` |
| `CompilerManifestV1.verifier_source` | `0x000d` |
| `CompilerManifestV1.verifier_result` | `0x000e` |
| `AuditReviewV1.report` | `0x000f` |
| `AuditReviewV1.finding_set` | `0x0010` |
| `AuditReviewV1.exclusions` | `0x0011` |
| `DependencyStateV1.vulnerability_report` | `0x0012` |
| `DependencyStateV1.approved_exception` | `0x0013` |
| `TransferActionV1.memo` | `0x0020` |
| `ContractCallV1.canonical_arguments` | `0x0021` |

An artifact commitment is valid in a containing field only when the verifier
has its complete `ArtifactCommitmentV1` preimage, recomputes domain `0x0050`,
and confirms the exact kind above. The same bytes used in a different semantic
role intentionally produce a different commitment; arbitrary alternate kinds
for one field are invalid.

## 2. Governance enums

`GovernanceActionV1.action_type` is identical to the outer
`SigningPayloadV1.action_id`:

| Value | Meaning |
|---:|---|
| `1` | proposal |
| `2` | vote |
| `3` | execute |
| `4` | emergency CryptoRegistry disable |

`GovernanceActionV1.target_type`:

| Value | Meaning | Exact `target_id` |
|---:|---|---|
| `1` | governance proposal | 32-byte proposal ID |
| `2` | CryptoRegistry | 32-byte registry ID |
| `3` | protocol parameter | 64-byte domain `0x0050` commitment to canonical argument artifact kind `0x0021` |
| `4` | software upgrade plan | 32-byte governance-registered plan ID |
| `5` | ProvenanceRegistry | 32-byte registry ID |

For action `4`, target type MUST be `2`, `emergency_flag` MUST be true, and the
mutation commitment MUST identify a `RegistryMutationV1` that only schedules or
executes disablement. For actions `1..3`, `emergency_flag` MUST be false.

## 3. Authorization lifecycle enums

`PendingAuthorizationMutationV1.operation_kind` and `transition_type` use the
same exact value:

| Value | Operation/transition |
|---:|---|
| `1` | register key and activate new policy |
| `2` | rotate key and activate new policy |
| `3` | disable classical key and activate new policy |
| `4` | recover key/policy and activate new policy |

The required operation domains are respectively `0x0004`, `0x0005`, `0x0007`,
and `0x0008`. Resulting target key states are respectively `ACTIVE`, `ACTIVE`,
`DISABLED`, and `ACTIVE`. For recovery, the separate prior/compromised key is
marked `RECOVERED` as historical state.

`PolicyMutationV1.operation`:

| Value | Meaning |
|---:|---|
| `1` | activate registration |
| `2` | activate rotation |
| `3` | activate classical disable |
| `4` | activate recovery |

`KeyLifecycleRecordV1.operation_code`:

| Value | Meaning |
|---:|---|
| `1` | registration requested |
| `2` | rotation requested |
| `3` | classical disable requested |
| `4` | recovery requested |
| `5` | pending mutation cancelled |
| `6` | pending mutation activated |

## 4. `SecurityReasonV1.reason_code`

| Value | Meaning |
|---:|---|
| `1` | suspected key compromise |
| `2` | confirmed key compromise |
| `3` | algorithm/profile emergency disable |
| `4` | custody loss or unrecoverable key loss |
| `5` | authorized policy recovery |
| `6` | operator-requested precautionary disable |
| `7` | governance incident response |

Any registered artifact kind in section 1 is permitted for the evidence
commitment. Its kind is documentary metadata: validators verify the exact
artifact commitment but MUST NOT infer that an incident is valid, authorized,
or severe from the artifact kind. Authorization and transition validity derive
only from the reason code, dispatched policy, and canonical state. Unknown
reason codes or artifact kinds fail closed.

## 5. Provenance mutation enums

`ProvenanceRegistryMutationV1.operation`: add `1`, rotate `2`, revoke `3`.
Issuer roles remain BUILD `1`, COMPILER `2`, AUDITOR `3`, DEPLOYMENT `4`, LOG
`5`, and GOVERNANCE `6`. A rotation retains its issuer ID and role.

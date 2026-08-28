# Normative Precedence

The original client implementation specification and initial Phase 0 documents remain design inputs and historical evidence. Where they contain illustrative concatenation, incomplete structures, generic algorithm names, `EMERGENCY_ONLY` lifecycle state, two-record provenance, or other semantics changed by remediation, they are superseded by the documents in this `remediation/` directory.

Precedence for remediation candidate R9 is:

1. `R9_FREEZE_EVIDENCE.md`
2. `R8_AUTHORIZATION_AND_STATE_INVARIANTS.md`
3. `LITHO_CANONICAL_ENCODING_V1.md`
4. `HASH_DOMAIN_REGISTRY_V1.md`
5. `ARTIFACT_AND_ENUM_REGISTRIES_V1.md`
6. `SIGNING_AND_BRIDGE_OBJECTS_V1.md`
7. `AUTHORIZATION_ACTION_REGISTRY_V1.md`
8. `AUTHORIZATION_SEQUENCE_STATE_V1.md`
9. `CRYPTO_REGISTRY_AND_PROFILES_V1.md`
10. `AUTHORIZATION_AND_LITHIC_EFFECT_MODEL_V1.md`
11. `PROVENANCE_AND_EXPLORER_STATE_V1.md`
12. `RESOURCE_LIMITS_V1.md`
13. normative object vectors and their two schema-aware reference decoders
14. exact state/root/dispatcher evidence and independent Python/JavaScript constructors
15. source/evidence baselines
16. earlier architecture and implementation documents as non-normative context only

Any unresolved contradiction at the same precedence level fails closed and blocks implementation freeze until Autha approves a correction.

Every file outside `remediation/` is `SUPERSEDED - NON-NORMATIVE` for Phase 0
R9. No example, legacy manifest, or implementation may override the byte-level
rules above.

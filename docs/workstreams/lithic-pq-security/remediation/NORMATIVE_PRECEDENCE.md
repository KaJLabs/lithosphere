# Normative Precedence

The original client implementation specification and initial Phase 0 documents remain design inputs and historical evidence. Where they contain illustrative concatenation, incomplete structures, generic algorithm names, `EMERGENCY_ONLY` lifecycle state, two-record provenance, or other semantics changed by remediation, they are superseded by the documents in this `remediation/` directory.

Precedence for remediation candidate R8 is:

1. `R8_AUTHORIZATION_AND_STATE_INVARIANTS.md`
2. `LITHO_CANONICAL_ENCODING_V1.md`
3. `HASH_DOMAIN_REGISTRY_V1.md`
4. `ARTIFACT_AND_ENUM_REGISTRIES_V1.md`
5. `SIGNING_AND_BRIDGE_OBJECTS_V1.md`
6. `AUTHORIZATION_ACTION_REGISTRY_V1.md`
7. `AUTHORIZATION_SEQUENCE_STATE_V1.md`
8. `CRYPTO_REGISTRY_AND_PROFILES_V1.md`
9. `AUTHORIZATION_AND_LITHIC_EFFECT_MODEL_V1.md`
10. `PROVENANCE_AND_EXPLORER_STATE_V1.md`
11. `RESOURCE_LIMITS_V1.md`
12. normative object vectors and their two schema-aware reference decoders
13. exact state/root vectors and independent Python/JavaScript constructors
14. source/evidence baselines
15. earlier architecture and implementation documents as non-normative context only

Any unresolved contradiction at the same precedence level fails closed and blocks implementation freeze until Autha approves a correction.

Every file outside `remediation/` is `SUPERSEDED - NON-NORMATIVE` for Phase 0
R8. No example, legacy manifest, or implementation may override the byte-level
rules above.

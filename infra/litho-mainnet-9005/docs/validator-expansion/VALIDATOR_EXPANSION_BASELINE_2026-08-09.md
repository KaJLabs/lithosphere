# Validator expansion baseline - 2026-08-09

The read-only expansion preflight was run against the production LCD endpoint
`https://api-mainnet.litho.ai`.

## Result

- Cosmos chain ID: `lithosphere_9005-1` - pass.
- Maximum bonded validators: `100` - sufficient for the `33+` target.
- Currently bonded validators: `1`.
- Additional bonded validators required: `32`.
- Current operator-address uniqueness check: pass.
- Current consensus-public-key uniqueness check: pass.

The chain is technically capable of accepting the target validator count. No
validator-set mutation was performed.

## External inputs still required

Activation cannot begin until KaJ Labs approves at least 32 completed operator
intake records containing distinct public identities, consensus public keys,
node IDs, funded self-delegations, infrastructure attestations, security
contacts, and approval references. Operators must retain all private keys and
recovery material; those secrets are never submitted in the intake CSV.

After the sanitized intake passes `validate_validator_intake.py`, onboarding
can proceed through the controlled waves in `VALIDATOR_EXPANSION_33_PLAN.md`.


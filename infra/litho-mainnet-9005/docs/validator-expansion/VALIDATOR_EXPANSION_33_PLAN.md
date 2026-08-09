# LITHO mainnet validator expansion to 33+

Status: preparation only. No validator-set transaction is authorized by this
document.

Run the read-only live-state check before each wave:

```bash
python ../../scripts/check_validator_expansion_readiness.py \
  --rest-url https://REPLACE_WITH_APPROVED_LCD_ENDPOINT
```

Validate the completed, sanitized operator intake before approving the first
wave:

```bash
python ../../scripts/validate_validator_intake.py validator-intake.csv \
  --minimum-new 32
```

The validator-intake validator rejects placeholders, duplicate identities,
malformed public identifiers, incomplete security attestations, and invalid
commission/self-delegation values. It accepts public information only.

## Confirmed constraints

- Network: `lithosphere_9005-1` / EVM `9005`.
- The sealed staking parameter permits up to `100` bonded validators.
- Launch state used one bonded validator.
- The live bonded/unbonded set must be queried again immediately before every
  onboarding wave.
- Expansion is performed with normal on-chain staking transactions; genesis
  must not be edited or regenerated.

## Target

Onboard at least 32 additional independently operated validators so the active
set reaches at least 33. A validator counts toward this objective only after it
is bonded, signing, monitored and has completed its acceptance window.

Running 33 keys on one operator, one VPS or one failure domain does not meet
the security objective.

## Required input for each operator

1. legal/operator identity and emergency contact;
2. unique account/operator wallet and funded self-delegation;
3. unique CometBFT consensus public key and node ID;
4. evidence that private signing material was generated and backed up by the
   operator without disclosure;
5. validator and sentry locations/providers/failure domains;
6. persistent peer endpoints and firewall allowlists;
7. moniker, website, security contact and commission policy;
8. monitoring, alerting, backup and incident-response attestations.

Private keys, mnemonics and recovery material must never be entered in the
intake sheet or committed to Git.

## Rollout waves

| Wave | Target active set | New validators | Minimum observation window |
|---|---:|---:|---:|
| 0 | 1 | 0 | Capture live baseline and voting power |
| 1 | 4 | 3 | 24 hours |
| 2 | 7 | 3 | 24 hours |
| 3 | 13 | 6 | 48 hours |
| 4 | 21 | 8 | 72 hours |
| 5 | 33+ | 12+ | 7 days before closing expansion |

Pause a wave for chain halt, consensus instability, unexpected voting-power
concentration, excessive missed blocks, peer isolation, double-sign evidence,
or unresolved monitoring/backup failures.

## Per-validator gate

1. Validate the intake record and failure-domain independence.
2. Verify binary and genesis checksums against the mainnet release record.
3. Configure a private validator behind operator-controlled sentries.
4. Verify chain identity, peer connectivity and full synchronization without a
   consensus key active.
5. Obtain the consensus public key using `lithod tendermint show-validator`.
6. Independently review the `create-validator` JSON and transaction simulation.
7. Fund only the approved account and self-delegation amount.
8. Broadcast `lithod tx staking create-validator validator.json` using chain ID
   `lithosphere_9005-1` through the operator's approved signing process.
9. Confirm the validator becomes bonded and voting power matches approval.
10. Observe signing, missed blocks, peers, resource use and alerts for the wave
    acceptance window.

## Network-wide acceptance

- At least 33 validators report `BOND_STATUS_BONDED`.
- Every consensus key and operator address is unique.
- No single operator or failure domain controls an unsafe voting-power share.
- Block production and finality remain stable through every rollout wave.
- All validators have current monitoring, security contact and recovery
  attestations.
- No validator RPC or private signing service is exposed publicly.
- The final validator-set snapshot and transaction hashes are committed as an
  audit record without private material.

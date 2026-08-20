# Seven-validator expansion and admin migration

Status: preparation only. This plan authorizes no key generation, funding,
staking transaction, admin transfer, or retirement of the current validator.

## Objective

Add seven independently controlled validators (`validator-02` through
`validator-08`) to LITHO Mainnet, give each more bonded voting power than the
largest validator in the live pre-activation snapshot, and establish a stable
new validator group before migrating administrative controls.

Validator voting power and administrative authority are separate. Bonding
stake does not transfer a contract owner, Safe signer, guardian, treasury,
DNS, cloud, repository, or operator-account key. Every administrative control
must be inventoried and transferred through its own approved mechanism.

## Required client inputs

For each new validator:

1. named operator, emergency contact, moniker, website, and security contact;
2. independently administered VPS/sentry resources and failure domain;
3. unique operator account, validator address, consensus public key, and node ID;
4. approved self-delegation and commission values;
5. custody, offline backup, monitoring, and incident-response attestations;
6. transaction approval reference and activation-window approval.

Only public values belong in `validator-7-intake.csv`. Never place private
keys, mnemonics, passwords, SSH keys, or recovery material in the CSV or Git.

## Approved planning allocation

The client approved the following stake, initial commission, funding category,
date range, and rollback-control model. The date ranges do not yet define an
exact UTC start/end time and therefore do not authorize a transaction.

| Validator | Operator EVM address | Stake | Initial commission | Funding category | Planned dates | Rollback-control model |
| --- | --- | ---: | ---: | --- | --- | --- |
| Everest Nodes | `0xA7f2c5f37dBB248240dBC29c0AEF0A11af1dEC6d` | 24,800 LITHO | 5.0% | Foundation Validator Bootstrapping Treasury | 2026-09-01 to 2026-09-03 | 2-of-3 Foundation Ops Multisig + Governance Timelock |
| CloudQuorum Edge Systems | `0x1A47A44589387cA700d43d3E89B588d2822Ffc79` | 22,500 LITHO | 6.0% | Ecosystem Infrastructure Allocation | 2026-09-03 to 2026-09-05 | 2-of-3 Foundation Ops Multisig + Governance Timelock |
| NodeHarbor Technologies | `0xaE2243eAe96E8b67036Db7025215F91aF948E39a` | 21,000 LITHO | 5.5% | Foundation Validator Bootstrapping Treasury | 2026-09-05 to 2026-09-07 | 2-of-3 Foundation Ops Multisig + Governance Timelock |
| VantaVortex Computing | `0x2EBDf1107ab0574128104A74F8b0FA4Dfb3D126b` | 19,000 LITHO | 7.0% | Network Growth Reserve | 2026-09-07 to 2026-09-09 | Emergency Security Council subject to Governance Ratification |
| AeroGrid Cloud Infrastructure | `0x932cFd135aac700EcDb295dbDB461bd89dB38B54` | 17,500 LITHO | 6.5% | Ecosystem Infrastructure Allocation | 2026-09-09 to 2026-09-11 | Emergency Security Council subject to Governance Ratification |
| KeystoneWave Data Services | `0x4aa9f2D63E418Cc70706fecb2171DD3ddBF112Ac` | 15,000 LITHO | 7.5% | Network Growth Reserve | 2026-09-11 to 2026-09-13 | 3-of-5 Validator Operations Multisig + Governance Timelock |
| PrismPulse Edge Networks | `0x82fD50D9BA68597Bb2aE5D8734Fb124BdAcC176a` | 12,500 LITHO | 8.0% | Community Validator Expansion Reserve | 2026-09-13 to 2026-09-15 | 3-of-5 Validator Operations Multisig + Governance Timelock |

The cohort totals 132,300 LITHO, averages 18,900 LITHO, has a stake-weighted
initial commission of approximately 6.30%, and has a largest-member share of
approximately 18.75% within the new allocation.

Funding labels are accounting categories, not receiving addresses or proof
that a treasury account exists. Rollback control can stop later activations or
authorize a subsequent transaction; it cannot erase a finalized transaction
or bypass the 21-day unbonding period.

## Stake and voting-power gate

Voting power follows bonded tokens and can change through delegation. The
amount must therefore be calculated from a fresh live snapshot, not from the
historical 1 LITHO genesis stake.

Each planned self-delegation must be strictly greater than the designated
original validator's live token balance. The combined new group must project
to more than two-thirds of bonded voting power if the
client intends to rely on that group for consensus continuity. This is a
projection, not a permanent guarantee.

Run the public intake and live projection gates:

```bash
python ../../scripts/validate_validator_intake.py validator-7-intake.csv \
  --minimum-new 7 --expected-new 7 --minimum-commission-rate 0.05 \
  --minimum-self-delegation-exclusive <ORIGINAL_VALIDATOR_LIVE_TOKENS_ULITHO>

python ../../scripts/check_seven_validator_voting_power.py \
  validator-7-intake.csv --rest-url https://api-mainnet.litho.ai \
  --comparison-operator <ORIGINAL_LITHOVALOPER_ADDRESS>
```

Run the full seven-validator projection immediately before the first
activation. Before later waves, refresh the live bonded set and confirm the
original comparison validator has not received enough new delegation to
invalidate any remaining approved self-delegation. Do not add already-bonded
new validators to the projection a second time.

## Controlled sequence

### Phase 0 — approval and baseline

- Record chain ID, height, bonded set, token balances, voting-power shares,
  staking/slashing parameters, binary hash, and genesis hash.
- Complete and validate the seven intake records.
- Approve exact stake allocation, funding source, commissions, operators,
  failure domains, maintenance window, and rollback authority.
- Inventory all administrative controls using
  `admin-control-migration.template.csv`.

### Phase 1 — synchronize without voting power

- Provision all seven nodes from checksum-pinned artifacts.
- Keep consensus signing inactive while each node synchronizes.
- Verify chain identity, genesis, binary, peers, firewall, time sync, disk,
  monitoring, backups, and operator access.
- Confirm each consensus public key and node ID is unique.

### Phase 2 — staged activation

Activate one validator at a time in the approved allocation order. For every
validator:

1. rerun live readiness and voting-power projection;
2. independently review transaction JSON and simulation;
3. fund only the approved operator account and amount;
4. broadcast one `create-validator` transaction;
5. verify bonded status, voting power, signing, and transaction hash;
6. observe it for at least 24 hours before broadcasting the next validator's
   transaction.

Pause for a chain halt, finality degradation, unexpected voting-power change,
missed-block breach, peer isolation, key/backup issue, or failed alert.

### Phase 3 — stability acceptance

- All seven validators are bonded, signing, monitored, and uniquely operated.
- Each new validator still has more voting power than the comparison
  validator recorded at the current acceptance snapshot.
- The new group has the client-approved aggregate voting-power share.
- Run at least a 72-hour final soak after the last wave.
- Do not unbond or retire the original validator during this soak.

### Phase 4 — administrative-control migration

For each row in the admin-control inventory:

1. verify the current and target public owners independently;
2. record the precise transfer mechanism and required approvals;
3. test the target control with a non-destructive action where possible;
4. execute through the approved signer/multisig/governance process;
5. verify final ownership from an independent endpoint;
6. retain rollback until acceptance and then revoke obsolete access.

Consensus majority alone must never be treated as evidence that an admin
control moved. Do not transfer secrets through chat or commit them.

### Phase 5 — original-validator decision

After validator and admin acceptance, KaJ Labs may retain, reduce, unbond, or
replace the original validator through a separately approved transaction.
Confirm that the chain keeps more than two-thirds active voting power through
the change and preserve signing state for rollback/audit purposes.

## Closure evidence

- seven `create-validator` transaction hashes and bonded validator records;
- before/after voting-power snapshots and projection output;
- 72-hour signing, peer, resource, and alert evidence;
- unique operator, consensus-key, node, provider, and failure-domain record;
- completed public admin-control inventory with execution references;
- explicit KaJ Labs acceptance and original-validator disposition decision.

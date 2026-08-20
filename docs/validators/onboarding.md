# LITHO mainnet validator onboarding

This is the public intake and activation guide for validator operators joining
LITHO Mainnet. It complements the command-level
[validator setup guide](../quickstart/validator-setup.md). A completed
application does not authorize funding or an on-chain transaction.

## Mainnet identity

| Item | Value |
| --- | --- |
| Cosmos chain ID | `lithosphere_9005-1` |
| EVM chain ID | `9005` (`0x232d`) |
| Native and bond asset | `LITHO` / `ulitho` |
| Precision | 18 decimals (`1 LITHO = 10^18 ulitho`) |
| REST/LCD | `https://api-mainnet.litho.ai` |
| CometBFT RPC | `https://rpc-mainnet.litho.ai` |
| Explorer | `https://lithoscan.ai` |
| Genesis | `https://rpc-mainnet.litho.ai/genesis.json` |
| Genesis SHA-256 | `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` |
| Maximum bonded validators | 100 |
| Unbonding period | 21 days |
| Minimum commission | 5% |

Operators must query the staking and slashing parameters again before signing
because governance may change them.

## What an operator must submit

Submit only public identifiers and non-secret attestations:

1. organization, moniker, website, technical contact, and security contact;
2. EVM account, LITHO account, and `lithovaloper` addresses;
3. 32-byte base64 CometBFT consensus public key;
4. 40-hex-character P2P node ID;
5. approved public sentry peer endpoints in `node-id@host:port` format;
6. hosting provider, region, independent failure domain, and ownership;
7. intended self-delegation and complete commission parameters;
8. monitoring, incident response, key backup, restore, upgrade, and
   double-sign-prevention attestations.

Never submit a mnemonic, operator private key, `priv_validator_key.json`, SSH
credential, bearer token, or backup/recovery secret. Private topology and
administrative assignments belong in the approved private infrastructure
record, not a public issue or chat.

Operators can print the required public node identities locally:

```bash
lithod tendermint show-validator --home <VALIDATOR_HOME>
lithod tendermint show-node-id --home <VALIDATOR_HOME>
lithod keys show <OPERATOR_KEY_NAME> -a --home <VALIDATOR_HOME>
lithod keys show <OPERATOR_KEY_NAME> -a --bech val --home <VALIDATOR_HOME>
```

The consensus public key, node ID, and operator account must be unique. Never
reuse the same consensus key on a standby or second active node.

## Readiness process

### 1. Application review

KaJ Labs validates the public identities, operator ownership, stake and
commission proposal, failure-domain independence, custody attestations, and
funding category. Missing or placeholder fields fail closed.

### 2. Node preparation

The operator installs the checksum-approved binary and genesis, runs a private
validator behind operator-controlled sentries, restricts RPC and administrative
ports, and enables monitoring. The node synchronizes with consensus signing
inactive.

### 3. Transaction preparation

After the node reports `catching_up: false`, the operator and coordinator
independently review:

- operator and `lithovaloper` addresses;
- consensus public key and moniker;
- exact self-delegation in `ulitho`;
- commission rate, maximum rate, and maximum daily change;
- minimum self-delegation;
- simulated gas and reviewed fee;
- exact UTC window, funding transaction, approval reference, and rollback
  authority.

The operator signs through its approved custody process. No private key is
sent to KaJ Labs.

### 4. Staged activation

Only one reviewed `create-validator` transaction is broadcast for an operator.
After confirmation, verify bonded status, voting power, signing, peers,
resources, and alerts before proceeding. Pause the rollout for a chain halt,
finality degradation, excessive missed blocks, peer isolation, unexpected
voting-power concentration, or a custody/monitoring failure.

### 5. Acceptance

A validator is accepted only after its transaction hash, bonded record,
consensus identity, voting power, monitoring, and observation evidence are
recorded. Administrative-control migration is separate from staking and needs
its own explicit approval.

## September 2026 planned cohort

| Validator | Self-delegation | Initial commission | Funding category | Planned dates |
| --- | ---: | ---: | --- | --- |
| Everest Nodes | 24,800 LITHO | 5.0% | Foundation Validator Bootstrapping Treasury | Sep 1-3 |
| CloudQuorum Edge Systems | 22,500 LITHO | 6.0% | Ecosystem Infrastructure Allocation | Sep 3-5 |
| NodeHarbor Technologies | 21,000 LITHO | 5.5% | Foundation Validator Bootstrapping Treasury | Sep 5-7 |
| VantaVortex Computing | 19,000 LITHO | 7.0% | Network Growth Reserve | Sep 7-9 |
| AeroGrid Cloud Infrastructure | 17,500 LITHO | 6.5% | Ecosystem Infrastructure Allocation | Sep 9-11 |
| KeystoneWave Data Services | 15,000 LITHO | 7.5% | Network Growth Reserve | Sep 11-13 |
| PrismPulse Edge Networks | 12,500 LITHO | 8.0% | Community Validator Expansion Reserve | Sep 13-15 |

The cohort contains 132,300 LITHO. Its average allocation is 18,900 LITHO,
its stake-weighted initial commission is approximately 6.30%, and its largest
member represents approximately 18.75% of the cohort stake.

The dates above do not include approved times of day. Exact UTC windows and
the remaining operator records must be published before activation. Funding
categories are not fee addresses or instructions to transfer funds.

## Rollback and slashing realities

A multisig or governance body may stop a later activation, withhold unspent
funding, or authorize a subsequent validator transaction. It cannot erase a
finalized `create-validator` transaction or instantly recover bonded stake.
Unbonding currently takes 21 days.

Current mainnet slashing parameters include a 10,000-block signed window, 50%
minimum signing rate, 10-minute downtime jail, 1% downtime slash, and 5%
double-sign slash. Operators and delegators share economic risk, so every
operator must verify current on-chain values before registration.

## Final checklist

- Mainnet chain IDs, binary, and genesis checksums verified.
- Public operator, validator, consensus, and node identities verified unique.
- Private validator is synchronized behind healthy sentries.
- RPC, REST, gRPC, EVM, metrics, and administration are not publicly exposed
  from the validator.
- Consensus-key backup and double-sign controls tested.
- Exact stake and all commission parameters approved.
- Funding source, exact UTC window, and rollback authority approved.
- Transaction independently reviewed and simulated.
- Bonded/signing status and monitoring verified after broadcast.
- Transaction hash and acceptance evidence recorded.

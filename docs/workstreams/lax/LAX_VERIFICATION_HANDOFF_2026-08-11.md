# LAX verification and handoff report

Date: 2026-08-11  
Verification time: 2026-08-11T14:26Z through 2026-08-11T14:29Z  
Scope: read-only source, RPC, bridge, and explorer verification. No transactions were signed or submitted.

## Executive status

LAX is deployed on the Kamet and Makalu test networks as an 18-decimal LEP100/ERC20-compatible token with a reported fixed supply of 10,000,000,000 LAX. Both historical MultX bridge contracts recognize their network's canonical LAX token and both bridges are currently paused.

LAX is **not verified as deployed on LITHO mainnet chain 9005**. The two known testnet addresses contain no code on chain 9005. This does not prove that no other LAX contract exists on mainnet; it means no approved mainnet address or deployment record was found in the reviewed material.

LAX must not be represented as production-ready. The following release blockers remain:

1. Product semantics are unresolved: the deployed/source contract is fixed-supply and burnable, while public documentation describes an algorithmically adjusted/rebasing asset.
2. The Kamet and Lithoscan token APIs advertise the Makalu LAX address, which contains no code on Kamet or LITHO mainnet.
3. The Makalu deployed runtime does not reproduce from the current `LEP100Token` artifact after normalizing compiler metadata and the immutable decimals field. Historical source/compiler evidence or explorer verification is required.
4. No approved mainnet contract address, governance owner, deployment transaction, audit acceptance, or activation approval was found.
5. MultX remains paused and unaudited for production; LAX bridge activation must remain disabled with the rest of MultX.

## Verified deployments

| Network | EVM chain ID | Canonical LAX address | Code | Name / symbol | Decimals | Total supply | Owner |
| --- | ---: | --- | ---: | --- | ---: | ---: | --- |
| Kamet | 900523 | `0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb` | 2,364 bytes | Lithosphere Algo / LAX | 18 | 10,000,000,000 LAX | `0xE9267bDf7084815B0754545049AE45FE744Aefa8` |
| Makalu | 700777 | `0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d` | 2,363 bytes | Lithosphere Algo / LAX | 18 | 10,000,000,000 LAX | `0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF` |

The raw `totalSupply()` value returned by both contracts was `10000000000000000000000000000` base units.

### Mainnet probes

The chain 9005 RPC reported chain ID 9005 and was producing blocks during verification. No code was present at either known testnet LAX address:

- `0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb`: 0 code bytes.
- `0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d`: 0 code bytes.

These probes are evidence only for the tested addresses, not a global assertion that no LAX contract exists anywhere on chain 9005.

## MultX bridge state

| Network | Bridge | Paused | Required signatures | LAX supported | Owner |
| --- | --- | --- | ---: | --- | --- |
| Kamet | `0x3a896BDF3a1088287FA84aB5a43bB30e2535F263` | Yes | 5 | Yes | `0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF` |
| Makalu | `0x5832D5E609c6690f74c7683606Eb20F89ff096a6` | Yes | 5 | Yes | `0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF` |

The older deployment JSON files record three validators and a 2-of-3 threshold. Live calls return a five-signature threshold, so those files are historical and must not be used as current authority evidence.

The bridges above are historical testnet deployments and do not match the frozen MultX v0.5 audit-candidate runtime. They must not be described as the audited or final v0.5 deployment.

## Source and bytecode review

The current source implementation is `MultX/contracts/contracts/LEP100Token.sol`. It provides:

- standard ERC20 transfers and allowances;
- a fixed supply minted to the deployer during construction;
- holder-accessible burning;
- an owner role inherited from OpenZeppelin `Ownable`;
- configurable immutable decimals.

It does **not** provide:

- rebasing;
- an oracle or price feed;
- algorithmic supply adjustment;
- collateral management;
- protocol-controlled minting after construction;
- peg-maintenance logic.

Consequently, the contract currently deployed as LAX does not implement the rebasing behavior described in the public tokenomics and whitepaper text.

### Runtime comparison

The current artifact and live runtime were compared after removing Solidity CBOR metadata and normalizing the 32-byte immutable decimals location.

| Target | Normalized result |
| --- | --- |
| Current `LEP100Token` artifact | Keccak-256 `0x909341634cd64ade4ab87bde11ec4a55168b9098d5ac37f37f2c5cd1c96e2ef3` |
| Kamet LAX | Matches the current normalized artifact |
| Makalu LAX | Does not match the current normalized artifact |

The Makalu mismatch may result from a different source revision, compiler configuration, or dependency version. It requires an exact historical build record before the contract can be claimed as source-verified.

## Explorer and API findings

At verification time:

- `https://makalu.litho.ai/api/tokens` correctly listed Makalu LAX at `0x1Cde...d4b8d`.
- `https://kamet.litho.ai/api/tokens` incorrectly listed the Makalu address `0x1Cde...d4b8d`; that address has no code on Kamet.
- `https://lithoscan.ai/api/tokens` listed the same Makalu address; that address has no code on LITHO mainnet chain 9005.

This is a display/indexing configuration defect. Until corrected, users could add or follow an address that is not a deployed token on the selected network.

## Repository inventory

The KaJ Labs Lithosphere repository contains LAX references across:

- `MultX/contracts`: generic LEP100 source, testnet deployment scripts, deployment records, and bridge configuration;
- `MultX/sdk`: Kamet and Makalu token presets;
- `MultX/api`: bridge route configuration and faucet asset data;
- `MultX/web`: token registry and bridge UI configuration;
- `Makalu/api`, `Makalu/indexer`, and `Makalu/infra`: explorer API, indexer seeds, and database seeds;
- `docs` and `Makalu/packages/docs`: public LAX product/tokenomics descriptions.

Several scripts contain older Kamet LAX address `0x508a1cB83949C9E0EB5FE698d11438EF55bFb5E1`. These historical scripts must not be treated as the canonical current deployment configuration.

## Required decisions and work

### KaJ Labs product/legal decision

Choose and approve one definition before any mainnet deployment:

1. **Fixed-supply LAX:** retain the current fixed-supply burnable implementation and correct all documentation that claims rebasing or algorithmic peg maintenance; or
2. **Algorithmic LAX:** specify, threat-model, implement, test, economically review, and independently audit the required oracle and supply-control system.

This decision materially changes risk and implementation. It must not be inferred by engineering.

### Engineering work available after product approval

1. Correct Kamet and Lithoscan token seed/configuration data and add a chain-code validation gate.
2. Remove or clearly mark superseded LAX addresses in executable scripts.
3. Add dedicated `LEP100Token` unit tests, including fixed-supply, ownership, burning, decimals, and constructor-boundary cases.
4. Reproduce or formally archive the exact Makalu source/compiler build.
5. Prepare a mainnet deployment manifest containing the approved implementation, owner/governance address, supply, deployer separation, bytecode checksum, verification steps, and rollback/abort rules.
6. Submit the approved implementation to independent audit when required by its final design.
7. Deploy only after explicit mainnet approval, then publish the transaction, address, source verification, and acceptance evidence.

## Current delivery statement

LAX testnet token contracts exist and are recognized by the paused historical MultX bridges. LAX mainnet delivery is not complete. The immediate engineering correction is the network-specific explorer/API address defect; the main product blocker is deciding whether LAX is a fixed-supply token or the algorithmic/rebasing asset described in public documentation.


# LITHO Mainnet 9005 Preparation

Status: **base chain launched and independently reverified on 2026-07-28**.

The client handoff entry point is
[`CLIENT_HANDOFF_2026-07-29.md`](CLIENT_HANDOFF_2026-07-29.md), with the
current [operations runbook](MAINNET_OPERATIONS_RUNBOOK.md) and
[acceptance checklist](CLIENT_ACCEPTANCE_CHECKLIST.md). The
[ownership and admin-control handover](OWNERSHIP_AND_ADMIN_CONTROL_HANDOVER.md)
defines KaJ Labs' accountable ownership, technical-control boundaries, and the
validator-key replacement procedure. The authoritative
launch evidence is in `LAUNCH_RECORD_2026-07-28.md`.

Client-ready PDFs:

- [Validator setup guide](../../LITHO_Validator_Setup_Guide.pdf)
- [Mainnet handoff](CLIENT_HANDOFF_2026-07-29.pdf)
- [Operations runbook](MAINNET_OPERATIONS_RUNBOOK.pdf)
- [Ownership and admin-control handover](OWNERSHIP_AND_ADMIN_CONTROL_HANDOVER.pdf)
- [Acceptance checklist](CLIENT_ACCEPTANCE_CHECKLIST.pdf)

Exchange integration package:

- [Combined exchange package (PDF)](exchange/LITHO_MAINNET_EXCHANGE_FULL_PACKAGE.pdf)
- [Google Docs import package (DOCX)](exchange/LITHO_MAINNET_EXCHANGE_FULL_PACKAGE.docx)
- [Master questionnaire response](exchange/LITHO_MAINNET_EXCHANGE_INTEGRATION.md)
- [Exchange node guide](exchange/MAINNET_EXCHANGE_NODE_GUIDE.md)
- [Exchange API reference](exchange/MAINNET_EXCHANGE_API_REFERENCE.md)
- [LEP100 exchange integration](exchange/LEP100_EXCHANGE_INTEGRATION.md)
- [External release checklist](exchange/EXCHANGE_DOCUMENTATION_RELEASE_CHECKLIST.md)
- [Exchange package checksums](exchange/EXCHANGE_PACKAGE_SHA256SUMS.txt)

## Confirmed

- Candidate EVM chain ID: `9005`
- Cosmos/CometBFT chain ID: `lithosphere_9005-1`
- EIP-155 registry check on 2026-07-21: no registered entry or matching PR
- Proposed public endpoints approved by the client:
  - RPC: `https://rpc-mainnet.litho.ai`
  - WebSocket: `wss://rpc-mainnet.litho.ai/websocket`
  - REST: `https://api-mainnet.litho.ai`
  - gRPC: `grpc-mainnet.litho.ai:9090`
- Six client-supplied allocation addresses are valid EIP-55 addresses and unique
- Supplied percentages total `100.0%`
- Supplied whole-token amounts total `1,000,000,000 LITHO`
- Native LITHO uses 18 decimals: `1 LITHO = 10^18 ulitho`
- Maximum supply is permanently fixed at `1,000,000,000 LITHO`; the protocol
  must not mint above that cap.
- No security-reserve wallet or amount will be allocated at genesis. Initial
  rewards can therefore come only from transaction fees unless holders later
  transfer already-issued LITHO into an approved reward mechanism. Protocol
  burns permanently reduce total supply.
- Genesis starts with one validator, moniker `validator1`, bonded with exactly
  `1 LITHO` (`10^18 ulitho`).
- `validator1` wallet: `0xba2b6fA3758296c5237235b2aF3Ba2a96D36A860`
  (`litho1hg4klgm4s2tv2gmjxke27waz49knd2rq908aw2`; operator address
  `lithovaloper1hg4klgm4s2tv2gmjxke27waz49knd2rq5tzfcw`). This is the validator
  identity, not a seventh token allocation.
- The bonded `1 LITHO` remains part of the fixed one-billion allocation. It must
  be debited from the largest supplied allocation, wallet
  `0x903AA7a6fc37F1947B6e4fC3832139A8D4152149`; it is not an additional mint.
- Final genesis allocation for `0x903A…2149` is `299,999,999 LITHO`; the other
  five supplied allocations are unchanged, and the validator wallet owns the
  remaining `1 LITHO` as bonded stake.
- After bonding, the six owners collectively hold `999,999,999 LITHO` liquid
  plus `1 LITHO` bonded. Future validator funding must use transfers/delegations
  of existing tokens, never new issuance.
- MultX is outside the initial mainnet launch scope and will be introduced only
  after its separate test, audit, and bug-check cycle.
- The client approved normal empty-block production and explicitly removed the
  custom height-1 message requirement.

## Infrastructure inputs

- Dedicated mainnet validator host: `194.5.157.233`
- Administrative user: `root`
- Authentication material was supplied out of band and must not be committed,
  copied into inventory, or written to deployment logs.
- Deployment public key installed and key-only SSH verified on 2026-07-23.
- Non-root `lithoadmin` recovery login and independent key verified. Root
  password is locked; SSH password and keyboard-interactive authentication are
  disabled; root login is key-only (`prohibit-password`).
- Validator capacity verified: Ubuntu 26.04 LTS, x86_64, 8 vCPU, 31 GiB RAM,
  385 GiB free disk, synchronized UTC clock. Mainnet node ports are unused and
  no mainnet service is installed.
- Checksum-pinned `lithod` candidate installed at `/usr/local/bin/lithod`:
  Evmos `v20.0.0`, commit `eca13ef2521a9ef13c32e80b1b147230bdb155b5`,
  SHA-256 `fc58df03a0160243c99e97cda992f38382d13d9e4a06dc7756dead783c19e498`.
- Fixed-supply mainnet binary installed alongside the fleet binary at
  `/usr/local/bin/lithod-mainnet-9005` on all three selected hosts. SHA-256:
  `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`.
  It enforces an exact one-billion LITHO genesis supply, permanently disables
  inflation parameter re-enablement, and rejects completed transactions above
  the native supply cap. Focused tests and a non-compliant-genesis startup
  rejection probe passed on 2026-07-23.
- Dedicated `wg-mainnet` keys generated on the validator and both sentries;
  public keys are pinned in the Ansible inventory. The mesh is active and
  fresh bidirectional handshakes were verified at launch.
- `validator1` node and consensus identity generated on 2026-07-23 using
  `lithosphere_9005-1`. Node ID:
  `cdb42540c4be4728a1e435fd2af89c8c7920eeb8`. Private key files remain only
  on the validator with mode `0600`; the autogenerated placeholder genesis is
  quarantined as `genesis.bootstrap.NOT_FOR_LAUNCH.json`.
- Isolated mainnet identities were generated on both sentries without stopping
  their existing services: sentry 1 node ID
  `76cadd27f507c401f58c1335c3f5ece39412f179`, sentry 2 node ID
  `94aa07934bc0614134056bcfe90feb0d214a6e66`. Their private identity files use
  mode `0600` and placeholder genesis files are quarantined. Both sentry
  services are now active on the sealed mainnet genesis.
- Mainnet is VPS-only; AWS is excluded.
- Sentry/RPC 1: `31.97.39.146`, replacing only its obsolete
  `lithosphere_700777-1` sentry service slot.
- Sentry/RPC 2: `72.60.177.106`, replacing only its obsolete
  `lithosphere_700777-1` sentry service slot.
- Active Makalu and Kamet services remain unchanged. The full mapping and
  isolation rules are in `VPS_DEPLOYMENT_PLAN.md`.

The machine-readable draft is in `genesis-allocations.draft.json`.

The validated, unsealed candidate is `genesis.candidate.json`, generated by
`scripts/generate_litho_mainnet_9005_genesis.py`. It passed module validation,
the fixed-supply InitChain handshake, two-block production, Cosmos chain-ID,
EVM chain-ID, bonded-stake, and total-supply assertions. Its timestamp and hash
are candidate evidence only.

The final `genesis.json` was sealed for `2026-07-27T17:00:00Z` with SHA-256
`13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` and
staged into all three launch homes on 2026-07-24. The full read-only preflight
passed on all three VPS hosts. The services launched on 2026-07-28 without
modifying the sealed genesis.

The no-message launch behavior is documented in
`FIRST_BLOCK_MESSAGE_CEREMONY.md`.

## Post-launch follow-up

1. Provide an auditable label/purpose for each allocation wallet.
2. Confirm the transaction-fee distribution and protocol-burn parameters. There
   is no genesis security reserve or reserve-emission mechanism.
3. Confirm the remaining genesis and governance parameters.
4. Complete and preserve the external chain-registry acceptance record for
   EVM chain ID `9005`.
5. Preserve the pinned mainnet binary and final genesis checksums.
6. Periodically verify both encrypted offline validator identity backups.
7. DNS, TLS, and proxy rate limiting are active. Add mainnet monitoring and
   paging, implement recurring live signing-state backups, and restrict raw
   node ports after integration consumers move to the TLS endpoints.
8. **Completed 2026-07-31:** the isolated mainnet Lithoscan indexer was
   synchronized, `lithoscan.ai` was switched to mainnet, and public smoke,
   synchronization, and rollback-closeout checks passed.

Do not adapt either existing root genesis file: `genesis.json` belongs to
`lithosphere_700777-1`, and `kamet-genesis.json` belongs to
`lithosphere_900523-1`.

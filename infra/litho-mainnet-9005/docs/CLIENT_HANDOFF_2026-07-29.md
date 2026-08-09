# LITHO Mainnet 9005 Client Handoff

Last reviewed: 2026-07-29

Handoff status: **conditional acceptance requested**. The base chain and public
node endpoints are live. The operational controls listed under "Open gates"
must be assigned and closed; this document does not represent unconditional
production acceptance.

## 1. Delivered service

| Item | Delivered state |
|---|---|
| Network | LITHO mainnet |
| Cosmos/CometBFT chain ID | `lithosphere_9005-1` |
| EVM chain ID | `9005` (`0x232d`) |
| Native asset | `LITHO`; base denomination `ulitho`; 18 decimals |
| Fixed supply | `1,000,000,000 LITHO` |
| Genesis time | `2026-07-27T17:00:00Z` |
| Genesis SHA-256 | `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` |
| Mainnet binary SHA-256 | `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c` |
| Height-1 block hash | `7418C1962B64597EE91D6747ECE3D5325C8B17B261E4C0E4A109A9BAFE74F509` |
| Initial validator set | One bonded validator, `validator1`, bonded with `1 LITHO` |
| Launch result | Launched and independently reverified on 2026-07-28 |

The fixed-supply binary enforces the exact genesis supply, prevents inflation
from being re-enabled, and rejects completed transactions that would exceed
the native supply cap. This is a consensus-critical project patch that passed
focused internal tests; it has not received an independent third-party audit.

## 2. Client integration endpoints

| Interface | Production endpoint | Expected identity |
|---|---|---|
| EVM JSON-RPC | `https://rpc-mainnet.litho.ai` | `eth_chainId = 0x232d` |
| EVM WebSocket | `wss://rpc-mainnet.litho.ai/websocket` | EVM chain `9005` |
| REST/LCD | `https://api-mainnet.litho.ai` | `lithosphere_9005-1` |
| gRPC over TLS | `grpc-mainnet.litho.ai:9090` | `lithosphere_9005-1` |
| Read-only CometBFT | `https://rpc-mainnet.litho.ai/status` | `lithosphere_9005-1` |
| Final genesis | `https://rpc-mainnet.litho.ai/genesis.json` | SHA-256 above |

POST `/` on the RPC hostname is EVM JSON-RPC. Only allowlisted, read-only
CometBFT query routes are public. Broadcast and administrative CometBFT routes
are not exposed through the HTTPS proxy.

RPC and REST terminate on sentry 1. gRPC terminates on sentry 2 because port
`9090` on sentry 1 is occupied by an existing service. The certificates
installed at handoff expire on 2026-10-26; Certbot timers and Nginx reload hooks
were validated at activation.

### Handoff-day public recheck

At `2026-07-29T06:44Z`, two sequential public status queries advanced from
height `174683` to `174711`, reported `catching_up=false`, and identified
`lithosphere_9005-1`. EVM JSON-RPC returned `0x232d`; REST returned
`lithosphere_9005-1`; height 1 matched the sealed block hash; and the downloaded
genesis body and its response header both matched the approved SHA-256.

At handoff time, the same unauthenticated check did not accept Lithoscan as
publicly ready because its root request returned HTTP 403. That historical gate
was closed on 2026-07-31: the production cutover, public smoke tests, block
progression monitoring, clock-skew re-verification, and rollback closeout all
passed without requiring rollback.

## 3. Deployed topology

| Role | Host | Service | Mainnet home | Exposure |
|---|---|---|---|---|
| Validator | `194.5.157.233` | `lithod-mainnet-9005-val` | `/var/lib/litho-mainnet-9005-val` | Node APIs loopback-only; P2P through private mesh |
| Sentry/RPC 1 | `31.97.39.146` | `lithod-mainnet-9005-sentry` | `/var/lib/litho-mainnet-9005-sentry` | Public node and proxy traffic |
| Sentry/RPC 2 | `72.60.177.106` | `lithod-mainnet-9005-sentry` | `/var/lib/litho-mainnet-9005-sentry` | Public node and gRPC traffic |

The nodes use the dedicated `wg-mainnet` mesh (`10.200.5.0/24`, UDP `51825`).
This mainnet is VPS-only and has no AWS, KMS, or Secrets Manager dependency.
Existing Makalu and Kamet services on the shared sentries are separate and must
not be modified during mainnet work.

## 4. Evidence and delivered artifacts

| Artifact | Purpose |
|---|---|
| [Launch record](LAUNCH_RECORD_2026-07-28.md) | Sealed identity, launch steps, live verification, and endpoint activation |
| [Final genesis](genesis.json) and [checksum](genesis.json.sha256) | Canonical network bootstrap artifact |
| [Fixed-supply review](FIXED_SUPPLY_TECHNICAL_REVIEW_2026-07-23.md) | Internal review of the consensus-critical supply patch |
| [Validator backup status](VALIDATOR_IDENTITY_BACKUP_STATUS_2026-07-23.md) | Offline identity-backup evidence and checksum |
| [Restart incident record](INCIDENT_2026-07-28_VALIDATOR_RESTART.md) | Impact, root cause, recovery, and follow-up |
| [Topology and deployment plan](VPS_DEPLOYMENT_PLAN.md) | Host, port, isolation, and execution details |
| [Operations runbook](MAINNET_OPERATIONS_RUNBOOK.md) | Current mainnet checks and recovery guardrails |
| [Ownership and admin-control handover](OWNERSHIP_AND_ADMIN_CONTROL_HANDOVER.md) | Accountable ownership, transferred controls, Safe applicability, and validator-key replacement boundary |
| [Acceptance checklist](CLIENT_ACCEPTANCE_CHECKLIST.md) | Evidence review, owner assignment, and sign-off |
| [Lithoscan cutover record](LITHOSCAN_CUTOVER_READINESS_2026-07-29.md) and [closeout report](lithoscan-window-close.json) | Certificate installation, deployment identity, public cutover, smoke tests, synchronization, and rollback decision |

The tracked handoff package does not contain SSH private keys, validator
private keys, WireGuard private keys, recovery keys, certificates' private
keys, passwords, or API tokens. Transfer those only through the client's
approved secret manager or an authenticated out-of-band channel.

## 5. Scope boundary

Included in this handoff:

- sealed and checksum-pinned genesis;
- three-node VPS topology with a private validator/sentry mesh;
- one active bonded validator;
- fixed-supply mainnet binary and deployment automation;
- TLS node endpoints and read-only public CometBFT routes;
- production Lithoscan mainnet explorer and restricted rollback controls;
- two client-confirmed offline encrypted copies of the initial validator
  identity backup; and
- launch and incident evidence.

Not enabled or not included:

- Bridge, Swap, Faucet, and MultX;
- additional bonded validators or an active validator failover host;
- a remote signer or HSM; and
- an independent third-party audit of the fixed-supply patch.

## 6. Open gates

| Priority | Gate | Required closure |
|---|---|---|
| Critical | One validator is the entire active validator set | Client accepts the availability risk and approves a multi-validator or controlled failover roadmap. Never run a second signer with the same consensus key. |
| Critical | Recurring live signing-state backup is not enabled (`backup_enabled: false`) | Implement encrypted backups of the current `priv_validator_state.json`, test restoration without starting a signer, define retention, and name two custodians. The launch-time height-0 identity package is not a current-state backup. |
| High | Mainnet progression checks and Prometheus no-block rules are present, but protected credentials and 24/7 paging are not activated | Configure the `litho-mainnet-monitoring` environment, load the rules through private/allowlisted metrics paths, test routing, and assign primary plus backup response ownership. |
| High | Raw sentry node ports remain available during integration | Restrict raw RPC/REST/gRPC/EVM ports after consumers move to TLS endpoints; retain required P2P access. |
| High | Restore, failover, and transaction drills remain unrecorded | Execute controlled drills and retain evidence before claiming full operational readiness. |
| High | Consensus-critical fixed-supply patch has internal review only | Obtain an external review or record explicit client risk acceptance. |
| Medium | Allocation wallet purposes and remaining governance/economic parameters are not fully recorded | Supply auditable labels, fee/burn decisions, and governance owners. |
| Medium | EVM chain ID registry acceptance record is outstanding | Complete and archive the external registry submission/acceptance evidence. |

## 7. Handoff decision

The client may accept the running base-chain service while tracking the open
gates as post-handoff obligations, or withhold production acceptance until the
Critical and High items are closed. The decision, named owners, target dates,
and any explicit risk acceptances must be recorded in
[CLIENT_ACCEPTANCE_CHECKLIST.md](CLIENT_ACCEPTANCE_CHECKLIST.md).

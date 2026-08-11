# LITHO Mainnet 9005 Operations Runbook

Last reviewed: 2026-07-29

Use this runbook for `lithosphere_9005-1` only. Older repository runbooks may
refer to decommissioned AWS infrastructure, another chain ID, TMKMS, or a
different node home and must not be applied to this mainnet.

## 1. Safety rules

1. The validator consensus key and `priv_validator_state.json` are a
   single-writer pair. Never start another signer with the same key.
2. Never replace, reset, or roll back validator signing state to make a node
   start. Stop and escalate if the correct state cannot be proven.
3. Verify both chain IDs before and after every change: Cosmos
   `lithosphere_9005-1`, EVM `9005` (`0x232d`).
4. Change one sentry at a time and keep the other sentry healthy.
5. Do not regenerate or edit genesis. The only approved SHA-256 is
   `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`.
6. Do not replace the approved mainnet binary. Its SHA-256 is
   `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`.
7. Keep Makalu and Kamet services, homes, ports, and WireGuard interfaces out
   of mainnet changes.

## 2. Fast public health check

```bash
# Cosmos identity, height, time, and catch-up state
curl -fsS https://rpc-mainnet.litho.ai/status | jq '{
  network: .result.node_info.network,
  height: .result.sync_info.latest_block_height,
  block_time: .result.sync_info.latest_block_time,
  catching_up: .result.sync_info.catching_up
}'

# EVM identity; expected result is 0x232d
curl -fsS https://rpc-mainnet.litho.ai \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'

# REST identity
curl -fsS \
  https://api-mainnet.litho.ai/cosmos/base/tendermint/v1beta1/node_info \
  | jq '.default_node_info.network'

# Immutable genesis check
curl -fsS https://rpc-mainnet.litho.ai/genesis.json -o /tmp/litho-genesis.json
printf '%s  %s\n' \
  '13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f' \
  /tmp/litho-genesis.json | sha256sum --check
```

Run the status request twice, five to ten seconds apart. Healthy means the
height advances, `catching_up` is `false`, the latest block time is current,
and both chain IDs match. A valid HTTP response at a static height is not a
healthy chain.

If `grpcurl` is available:

```bash
grpcurl grpc-mainnet.litho.ai:9090 \
  cosmos.base.tendermint.v1beta1.Service/GetNodeInfo
```

## 3. Privileged full verification

From an authorized operator workstation with a client-managed SSH key:

```powershell
python scripts\verify_litho_mainnet_9005_live.py `
  --ssh-key "C:\secure-path\litho-validator" `
  --validator-host "$env:LITHO_VALIDATOR_HOST" `
  --sentry1-host "$env:LITHO_SENTRY1_HOST" `
  --sentry2-host "$env:LITHO_SENTRY2_HOST"
```

The read-only verifier requires strict known-host checking and validates all
three services, both chain IDs, peer counts, synchronization, fixed supply,
the one bonded validator, seven genesis balances, and the height-1 hash. Retain
its timestamped output with the change or incident record. Do not weaken its
SSH options to bypass a host-key mismatch; investigate the mismatch.

## 4. Service map and local checks

| Role | SSH host source | Service | Local Comet RPC | Local EVM RPC |
|---|---|---|---|---|
| Validator | `LITHO_VALIDATOR_HOST` / protected inventory | `lithod-mainnet-9005-val` | `127.0.0.1:26657` | `127.0.0.1:8545` |
| Sentry 1 | `LITHO_SENTRY1_HOST` / protected inventory | `lithod-mainnet-9005-sentry` | `127.0.0.1:27057` | `127.0.0.1:8945` |
| Sentry 2 | `LITHO_SENTRY2_HOST` / protected inventory | `lithod-mainnet-9005-sentry` | `127.0.0.1:27057` | `127.0.0.1:8945` |

On an affected host:

```bash
sudo systemctl is-active SERVICE
sudo systemctl is-enabled SERVICE
sudo systemctl show SERVICE -p ActiveEnterTimestamp -p NRestarts
sudo journalctl -u SERVICE --since '-30 min' --no-pager
sudo wg show wg-mainnet
curl -fsS http://127.0.0.1:COMET_PORT/status | jq '.result.sync_info'
curl -fsS http://127.0.0.1:COMET_PORT/net_info | jq '.result.n_peers'
sudo sha256sum /usr/local/bin/lithod-mainnet-9005
sudo sha256sum MAINNET_HOME/config/genesis.json
```

Expected peer baseline at handoff: validator `2`; each sentry at least `1`.
Check for recent `wg-mainnet` handshakes as well as peer counts.

## 5. Incident triage

### No new blocks for more than two minutes

Treat this as a production incident because one validator currently controls
block production.

1. Confirm the halt from two independent endpoints or from both sentries.
2. Freeze planned changes and record the last height and block time.
3. Check validator service state, restarts, disk, memory, time sync, journal,
   WireGuard handshakes, and peer count.
4. Prove that no other process or host is using the validator consensus key.
5. Preserve the validator journal, config, and current signing state before a
   change. Never publish or copy key contents into an incident ticket.
6. If the service is stopped and a single writer is proven, start the existing
   service once; do not launch a replacement signer.
7. Require consecutive block advancement on the validator and both sentries,
   `catching_up=false`, and a passing full verifier.
8. Open an incident record with impact, timestamps, cause, exact changes, and
   verification evidence.

The 2026-07-28 restart loop was caused by `double_sign_check_height = 10` and
was fixed durably at `0`. Do not rerun the incident recovery playbook as a
generic restart procedure: it contains incident-specific height and backup
assertions. See [the incident record](INCIDENT_2026-07-28_VALIDATOR_RESTART.md).

### One sentry is unhealthy

1. Verify the other sentry is healthy and advancing.
2. Remove the unhealthy sentry from public traffic if necessary.
3. Capture its journal, disk/memory state, peer state, and WireGuard state.
4. Restart only the affected sentry service.
5. Require the correct chain IDs, advancing height, fresh peers, and
   `catching_up=false` before returning traffic.
6. Do not restart the validator as part of sentry recovery unless it has an
   independently diagnosed fault.

### Both sentries or public endpoints are unhealthy

Check DNS/TLS/Nginx separately from node health. If local node RPCs advance,
restore the proxy path without touching consensus. If local node RPCs also
fail, handle each sentry one at a time. The validator must remain private.

### Suspected consensus-key compromise or duplicate signer

Stop the known validator service, isolate the host, preserve evidence, and
invoke the client security and custody owners immediately. Do not destroy the
suspected key, rotate it, restore state, or start another signer until a
chain-level recovery plan is approved. Key rotation is not merely a file
replacement because the on-chain validator identity must also be addressed.

## 6. Backup and restore controls

Two encrypted offline copies of the launch-time identity package were
client-confirmed, but that height-0 package does not contain current signing
state. Recurring live signing-state backup is an open Critical gate.

The repository now contains the encrypted streaming implementation, restricted
export-only Ansible playbook, scheduled workflow, and offline verification
procedure in [SIGNING_STATE_BACKUP_RUNBOOK.md](SIGNING_STATE_BACKUP_RUNBOOK.md).
The gate remains open until the client provisions the protected environments,
names two recovery custodians, completes a scheduled backup, and passes an
isolated restore-verification drill.

Before operational acceptance, the client must define and test a process that:

- snapshots the current `priv_validator_state.json` consistently;
- encrypts it before leaving the validator and never exposes plaintext in
  logs, chat, tickets, or version control;
- records a checksum, capture time, chain ID, and signed height;
- stores at least two separately controlled offline copies;
- names primary and backup custodians and retention; and
- performs a restore drill on an isolated host without starting `lithod`.

For a real restore, keep the original signer stopped and prove its signing
state is the authoritative latest state before copying the consensus key and
state as one controlled unit. If recency or single-writer status is uncertain,
do not start a validator.

## 7. TLS and endpoint operations

At handoff, Let's Encrypt certificates expire on 2026-10-26. Certbot timers
are enabled and renewal simulations passed. Operators must still alert on
certificate expiry and periodically confirm successful renewal and Nginx
reload on both sentries.

The public proxy rate limits RPC to `25` requests/second/IP and REST to `30`
requests/second/IP, with bounded bursts. Raw node ports are temporary
integration paths, not preferred production interfaces; close them after
dependency confirmation while retaining required P2P traffic.

The repository includes a read-only five-minute progression workflow and
Prometheus rules under `monitoring/prometheus/`. They check all three nodes,
chain identity, height advancement, peer floors, validator signing and missing
metrics. They are not an accepted paging control until the protected
`litho-mainnet-monitoring` environment has a restricted SSH identity, pinned
host keys, a tested Alertmanager/on-call route, and named primary plus backup
responders. Consensus metrics must remain private or allowlisted.

Install the dedicated forced-command identity on all three consensus nodes
with `ansible/playbooks/mainnet-9005-deploy-monitor-account.yml`, supplying
only a newly generated Ed25519 public key through a protected extra variable.
The root-owned wrapper permits only the exact service-state, CometBFT status,
and peer-count commands used by `monitor_mainnet_progression.py`; it denies
arbitrary commands, forwarding, PTY allocation and user startup files. Store
the corresponding private key only as `MONITOR_SSH_KEY` in the protected
GitHub environment and set `MONITOR_SSH_USER` to `lithomonitor`.

## 8. Change and maintenance procedure

For every change:

1. Record scope, owner, rollback, and approval.
2. Capture public health and run the full verifier.
3. Confirm current signing-state backup and single-writer ownership for any
   validator-impacting change.
4. Change sentries one at a time. Schedule validator work in an explicit
   maintenance window; unattended package restarts caused the launch-day halt.
5. Recheck certificate, chain IDs, height advancement, peers, supply, bonded
   validator, and height-1 hash.
6. Retain command output and close the change only after an observation window.

## 9. Escalation record

Complete these fields in the client-controlled copy; do not put personal
phone numbers or secret-manager recovery material in the public repository.

| Role | Named owner | Primary channel | Backup owner |
|---|---|---|---|
| Incident commander | KaJ Labs | `TBD` | KaJ Labs |
| Validator operator | KaJ Labs | `TBD` | KaJ Labs |
| Consensus-key custodian | KaJ Labs | `TBD` | KaJ Labs |
| DNS/Cloudflare owner | KaJ Labs | `TBD` | KaJ Labs |
| Monitoring/on-call owner | KaJ Labs | `TBD` | KaJ Labs |
| Explorer release owner | KaJ Labs | `TBD` | KaJ Labs |

KaJ Labs is the accountable organization in this repository copy. Record the
individual primary and backup contacts in the client-controlled escalation
register. The full control boundary is documented in
[OWNERSHIP_AND_ADMIN_CONTROL_HANDOVER.md](OWNERSHIP_AND_ADMIN_CONTROL_HANDOVER.md).

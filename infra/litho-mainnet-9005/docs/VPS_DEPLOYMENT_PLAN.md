# LITHO Mainnet 9005 — VPS Deployment Plan

Status: **base chain, production node endpoints, and Lithoscan mainnet explorer
launched, independently reverified, and cutover-accepted**.

## Selected topology

| Role | Host | Mainnet service | Mainnet home | Notes |
|---|---|---|---|---|
| Validator | `194.5.157.233` | `lithod-mainnet-9005-val` | `/var/lib/litho-mainnet-9005-val` | Dedicated validator; no public RPC/API |
| Sentry/RPC 1 | `31.97.39.146` | `lithod-mainnet-9005-sentry` | `/var/lib/litho-mainnet-9005-sentry` | Replaces only obsolete `700777-1` sentry slot |
| Sentry/RPC 2 | `72.60.177.106` | `lithod-mainnet-9005-sentry` | `/var/lib/litho-mainnet-9005-sentry` | Replaces only obsolete `700777-1` sentry slot |

AWS is not part of this topology. The active Makalu and Kamet services on the
two shared VPS hosts remain in place.

The other available VPS hosts were not selected: `31.97.39.138` is at 69% disk
usage and carries four node processes, while `187.124.51.229` already carries
six node processes and had materially higher load during the 2026-07-22
capacity check. They remain emergency capacity, not launch dependencies.

## Isolation

- Mainnet mesh: `10.200.5.0/24`, interface `wg-mainnet`, UDP `51825`.
- Validator mesh address: `10.200.5.1`.
- Sentry mesh addresses: `10.200.5.2` and `10.200.5.3`.
- Validator RPC, REST, gRPC, EVM RPC, and WebSocket bind to loopback only.
- Sentries reuse the obsolete fork's isolated slots: Comet P2P/RPC/metrics
  `27056/27057/27060`, REST `1717`, gRPC `9490`, EVM RPC/WS `8945/8946`.
- Active testnet service names, homes, ports, data, keys, and WireGuard meshes
  are not modified.

## Public endpoints

Approved names:

- EVM JSON-RPC: `https://rpc-mainnet.litho.ai`
- EVM WebSocket: `wss://rpc-mainnet.litho.ai/websocket`
- REST/LCD: `https://api-mainnet.litho.ai`
- gRPC: `grpc-mainnet.litho.ai:9090`
- Cosmos/CometBFT RPC: read-only paths on `https://rpc-mainnet.litho.ai`
- Final genesis: `https://rpc-mainnet.litho.ai/genesis.json`

The endpoints were published and externally validated on 2026-07-28. RPC and
API route through sentry 1 (`31.97.39.146`); gRPC routes through sentry 2
(`72.60.177.106`) because sentry 1 already uses port `9090` for another chain.
Both sentries returned EVM chain ID `9005`, Cosmos chain ID
`lithosphere_9005-1`, and matching chain state before publication.

The explorer handoff on 2026-07-29 explicitly approved read-only CometBFT
routes on the existing RPC hostname. `/status`, `/block`, and the other
allowlisted query routes proxy to CometBFT; POST `/` remains EVM JSON-RPC.
Transaction broadcast and administrative CometBFT routes are not published.

## Safe execution order

1. **Complete (2026-07-23):** install the deployment SSH public key on
   `194.5.157.233` and verify key-only login.
2. **Complete (2026-07-23):** verify validator capacity. Observed Ubuntu 26.04
   LTS, x86_64, 8 vCPU, 31 GiB RAM, 385 GiB free disk, synchronized UTC clock,
   and no conflicts on the planned mainnet ports.
3. **Complete (2026-07-23):** create and verify the `lithoadmin` non-root
   recovery account with an independent key and passwordless sudo; lock the
   exposed root password; disable SSH password/keyboard-interactive auth; keep
   root key-only (`prohibit-password`).
4. **Complete (2026-07-23):** generate dedicated mainnet WireGuard keys on all
   three hosts and pin their public keys. Generate the validator node/consensus
   identity with the client-approved, stock-compatible Cosmos chain ID
   `lithosphere_9005-1`, plus isolated node identities on both sentries.
   Interfaces remain inactive, placeholder genesis files are quarantined
   outside the launch paths, and no mainnet service was started.
5. **Complete (2026-07-23):** install a dedicated Evmos v20-derived mainnet
   binary at `/usr/local/bin/lithod-mainnet-9005` on the validator and both
   sentries, without replacing the active fleet binary. Its SHA-256 is
   `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`.
   The binary enforces the exact one-billion genesis supply, permanently
   disables inflation re-enablement, and applies a transaction-level supply
   ceiling. Focused tests and a startup rejection probe passed.
6. **Final genesis sealed (2026-07-23):** the `validator1` consensus key,
   governance/genesis parameters, exact allocations, and direct `1 LITHO`
   initial bond have passed `validate-genesis`, InitChain, and disposable local
   block-production tests. The stake is carved from allocation 1
   (`0x903A…2149`); no security reserve is allocated. The final
   `lithosphere_9005-1` genesis time is `2026-07-27T17:00:00Z`, and its pinned
   SHA-256 is
   `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`.
   The exact file was staged and checksum-verified in all three launch homes
   on 2026-07-24; all dedicated mainnet services remain inactive.
7. **Complete (2026-07-28):** back up `/var/lib/litho-makalu-sentry/config` on both selected sentries. Stop
   and disable only `lithod-makalu-sentry`, after verifying its genesis chain ID
   is `lithosphere_700777-1`. Preserve its data until rollback expires.
8. **Complete (2026-07-28):** deploy the mainnet WireGuard mesh and nodes from
   `ansible/inventory/mainnet-9005/`. Start sentries first, then the validator.
9. **Complete (2026-07-28):** confirm all three nodes share the same genesis hash and chain identity, are
   peered, and advance blocks without exposing the validator publicly.
10. **Endpoint publication complete; hardening remains:** TLS reverse proxies
   and endpoint smoke tests passed. Restart, failover, transaction, monitoring,
   backup, restore, and raw-port restriction tests remain.
11. **Complete (2026-07-28):** launch with normal empty-block production enabled; no custom height-1
    transaction is required. Confirm chain IDs, peer health, height-1
    production, and private smoke tests.
12. **Complete (2026-07-31):** installed and validated origin TLS, activated
    the restricted production vhost, switched `lithoscan.ai` from the Makalu
    redirect, passed public and synchronization monitoring, and closed the
    rollback window. Bridge, Swap, MultX, and Faucet remain disabled.

The build script now applies and tests
`bin/patches/evmos-v20-litho-fixed-supply.patch`. Internal technical review and
client owner risk acceptance are recorded. This is not an independent
third-party security audit; external review remains recommended because the
change is consensus-critical.

## Launch gate

Run from WSL/Linux:

```bash
cd ansible
ansible-playbook -i inventory/mainnet-9005/hosts.ini \
  playbooks/mainnet-9005-preflight.yml
```

The gate deliberately fails while any `PENDING_*` ceremony value or the final
genesis/checksum is absent. It performs no remote changes.

The final 2026-07-23 read-only run passed network identity, node/WireGuard,
genesis checksum, capacity, disk, VPS-only, and pinned-binary checks on all
three hosts. It completed with zero failures and made no host changes.

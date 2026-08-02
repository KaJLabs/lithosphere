# LITHO Mainnet 9005 Launch Record

Status: **base chain launched and independently reverified on 2026-07-28**.

Post-launch note: a validator restart-guard incident temporarily halted block
production later on 2026-07-28. It was recovered without changing genesis or
chain state and passed the full verifier again. See
`INCIDENT_2026-07-28_VALIDATOR_RESTART.md`.

## Sealed network identity

- Cosmos/CometBFT chain ID: `lithosphere_9005-1`
- EVM chain ID: `9005` (`0x232d`)
- Genesis time: `2026-07-27T17:00:00Z`
- Genesis SHA-256:
  `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`
- Mainnet binary SHA-256:
  `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`
- Height-1 block hash:
  `7418C1962B64597EE91D6747ECE3D5325C8B17B261E4C0E4A109A9BAFE74F509`
- Height-1 transactions: `0`, as approved for the no-message launch

The approved genesis time was already in the past when the services were
started. The sealed genesis was not edited or regenerated; the nodes started
from the checksum-pinned file and produced the first block normally.

## Launch execution

1. Confirmed two secure offline copies of the validator identity.
2. Backed up, stopped, and disabled only the obsolete
   `lithosphere_700777-1` sentry services occupying the mainnet port slots.
3. Activated the dedicated `wg-mainnet` mesh and verified fresh bidirectional
   handshakes between the validator and both sentries.
4. Started both sentries and then the validator.
5. Verified all three services are enabled and active with zero restarts and
   no panic, fatal, or double-sign evidence.

The retired sentry configuration archives are retained on each sentry under:

`/var/backups/litho-mainnet-9005-cutover/20260728T0400Z/`

Their former data homes were preserved for rollback.

## Independent live verification

The verifier was run again after launch:

```powershell
python scripts\verify_litho_mainnet_9005_live.py `
  --ssh-key "C:\Users\Bachal\.ssh\litho-validator"
```

It returned `LIVE_VERIFICATION=passed` and confirmed:

- all nodes report Cosmos chain ID `lithosphere_9005-1`;
- all sentry EVM interfaces report chain ID `9005`;
- validator, sentry 1, and sentry 2 were advancing at observed heights 976,
  1000, and 1027 respectively (queried sequentially);
- every node reported two peers and `catching_up=false`;
- exact supply is `1000000000000000000000000000 ulitho`
  (`1,000,000,000 LITHO`);
- one validator is bonded with `1000000000000000000 ulitho` (`1 LITHO`);
- all seven genesis balances match the sealed allocation;
- all nodes return the same height-1 block hash.

## Public endpoint and explorer handoff

The mainnet node interfaces are live on both sentries. Until DNS and TLS are
configured, the explorer team may use sentry 1 for controlled staging only:

- Cosmos RPC: `http://31.97.39.146:27057`
- EVM JSON-RPC: `http://31.97.39.146:8945`
- EVM WebSocket: `ws://31.97.39.146:8946`
- REST/LCD: `http://31.97.39.146:1717`
- gRPC: `31.97.39.146:9490`

Sentry 2 (`72.60.177.106`) exposes the same ports as a staging fallback.
These plaintext IP endpoints are not the final production URLs.

The production endpoint names remain:

- EVM JSON-RPC: `https://rpc-mainnet.litho.ai`
- EVM WebSocket: `wss://rpc-mainnet.litho.ai/websocket`
- REST/LCD: `https://api-mainnet.litho.ai`
- gRPC: `grpc-mainnet.litho.ai:9090`
- Cosmos/CometBFT RPC: read-only HTTPS routes on
  `https://rpc-mainnet.litho.ai`, including `/status` and `/block?height=1`
- Final genesis: `https://rpc-mainnet.litho.ai/genesis.json`

### Production endpoint activation

The production endpoints were activated and externally validated on
2026-07-28 after the DNS split was made explicit:

- `rpc-mainnet.litho.ai` and `api-mainnet.litho.ai` resolve to sentry 1
  (`31.97.39.146`).
- `grpc-mainnet.litho.ai` resolves to sentry 2 (`72.60.177.106`) because port
  `9090` on sentry 1 is occupied by a pre-existing chain service.
- EVM JSON-RPC returned `eth_chainId = 0x232d` (`9005`).
- REST/LCD returned Cosmos network `lithosphere_9005-1`.
- WSS returned `101 Switching Protocols` at `/websocket`.
- A real gRPC `GetNodeInfo` call returned `lithosphere_9005-1` through TLS on
  port `9090`.
- Read-only CometBFT `/status` and `/block?height=1` returned HTTP 200. Block 1
  matched the sealed height-1 hash. Unsafe broadcast/admin routes remain
  unavailable through this proxy.
- The HTTPS genesis artifact matched the approved SHA-256 and is also returned
  in the `X-Genesis-SHA256` response header.
- The final external snapshot observed EVM height `71582` at
  `2026-07-28T15:50:44Z`.

Let's Encrypt certificates are installed on both sentries and expire on
2026-10-26. Webroot renewal simulations passed, Certbot timers are enabled,
and successful renewal is configured to reload Nginx automatically.

At initial launch verification time, those three hostnames had no DNS records;
the activation above supersedes that historical state. Raw-port firewall
restrictions remain a hardening follow-up while the explorer team migrates
from the temporary IP endpoints. On 2026-07-29, the existing approved RPC
hostname was explicitly extended with path-based, read-only CometBFT routes;
POST `/` remains the EVM JSON-RPC endpoint.

The dedicated proxy template and guarded deployment playbook are prepared at
`monitoring/sentry-nginx/litho-mainnet-9005.conf.j2` and
`ansible/playbooks/mainnet-9005-deploy-public-proxy.yml`. The playbook refuses
to run without explicit publication confirmation and existing TLS file paths,
then revalidates both chain IDs before changing Nginx. Its Ansible syntax check
passed on 2026-07-28. After DNS and a SAN certificate for the three endpoint
names are ready, deploy to the primary sentry with:

```bash
cd ansible
ansible-playbook -i inventory/mainnet-9005/hosts.ini \
  playbooks/mainnet-9005-deploy-public-proxy.yml \
  -e mainnet_proxy_confirm=true \
  -e mainnet_proxy_tls_certificate=/path/to/fullchain.pem \
  -e mainnet_proxy_tls_certificate_key=/path/to/privkey.pem
```

Do not place certificate private-key material in inventory or version control.

The `lithoscan-mainnet` GitHub environment was provisioned on 2026-07-29 with
an isolated deployment identity, fresh production-only database/session
credentials, `SMOKE_BASE_URL`, and `GENESIS_URL`. The production TLS workflow
subsequently passed on 2026-07-30 using `lithoscan-deploy` and the restricted
certificate helper.

On 2026-07-31, `lithoscan.ai` was cut over from the Makalu redirect to the
mainnet explorer. Public UI/API, both chain IDs, TLS, release identity, block
progression, indexer lag, and restricted-feature gates passed. The monitoring
window closed without rollback; see the Lithoscan cutover record and
`lithoscan-window-close.json`.

Bridge, Swap, Faucet, and MultX remain disabled.

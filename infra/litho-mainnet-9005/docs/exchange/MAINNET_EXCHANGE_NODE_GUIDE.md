# LITHO Mainnet Exchange Node Guide

Last reviewed: 2026-07-29

Audience: exchange wallet, custody, and infrastructure teams operating a
non-validating `lithosphere_9005-1` full node.

Status: technically complete except for the public signed binary-release URL
and public snapshot URL. Do not substitute an older Lithosphere binary,
genesis, or testnet snapshot.

## 1. Immutable network inputs

| Input | Approved value |
|---|---|
| Cosmos chain ID | `lithosphere_9005-1` |
| EVM chain ID | `9005` (`0x232d`) |
| Binary | Linux x86_64 `lithod`, Evmos v20-derived fixed-supply build |
| Binary SHA-256 | `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c` |
| Genesis URL | `https://rpc-mainnet.litho.ai/genesis.json` |
| Genesis SHA-256 | `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` |
| Base denomination | `ulitho` (`10^18 ulitho = 1 LITHO`) |
| CometBFT version reported live | `0.38.12` |

The binary contains a consensus-critical fixed-supply patch. An exchange must
verify the exact release artifact and checksum before synchronization. The
public binary URL is currently `TBD`; obtain the artifact through the approved
release channel, not chat or an unverified file share.

## 2. Recommended production host

| Resource | Pruned exchange node | Archive/historical node |
|---|---:|---:|
| CPU | 8 vCPU | 8–16 vCPU |
| RAM | 32 GiB | 32–64 GiB |
| Disk | 500 GB NVMe SSD | 1 TB NVMe SSD initially |
| Network | Stable 100 Mbps+ | Stable 100 Mbps+ |
| OS | Ubuntu 24.04/26.04 LTS x86_64 | Ubuntu 24.04/26.04 LTS x86_64 |

Use a dedicated filesystem or volume for the node home. Monitor disk growth
and keep at least 30% free. A separate database should hold the exchange's
deposit index; node state is not an accounting database.

## 3. Port policy

Recommended local ports are standard and may be changed:

| Service | Default | Exposure |
|---|---:|---|
| CometBFT P2P | TCP `26656` | Public or outbound-only through NAT |
| CometBFT RPC | TCP `26657` | Loopback/private only |
| REST/LCD | TCP `1317` | Loopback/private only |
| gRPC | TCP `9090` | Loopback/private only |
| EVM JSON-RPC | TCP `8545` | Loopback/private only |
| EVM WebSocket | TCP `8546` | Loopback/private only |
| Prometheus | TCP `26660` | Monitoring network only |

Do not expose custody RPCs directly to the Internet. Place authentication,
rate limiting, request-size limits, and network ACLs in front of any shared
internal RPC.

## 4. Install the approved binary

Create a dedicated user and home:

```bash
sudo useradd --system --home /var/lib/litho-mainnet-9005-exchange \
  --shell /usr/sbin/nologin litho
sudo install -d -o litho -g litho -m 0750 \
  /var/lib/litho-mainnet-9005-exchange
```

Install the artifact received from the approved release channel:

```bash
sudo install -o root -g root -m 0755 ./lithod-mainnet-9005 \
  /usr/local/bin/lithod-mainnet-9005

echo '0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c  /usr/local/bin/lithod-mainnet-9005' \
  | sha256sum --check

/usr/local/bin/lithod-mainnet-9005 version --long
```

Stop if the checksum differs.

### Source-build fallback

The current source repository is
`https://github.com/BrewCodeDev/lithosphere-dev-infra`. Its
`bin/build-lithod.sh` checks out Evmos `v20.0.0`, applies the fixed-supply patch,
rebrands the chain, runs focused tests, and builds Linux x86_64 `lithod`.

Use a signed release tag/commit supplied by the project. Locally built binaries
may not be byte-for-byte identical because build metadata/toolchains can vary;
record the build environment, source commit, test output, and resulting hash.

## 5. Initialize the node

```bash
export LITHO_HOME=/var/lib/litho-mainnet-9005-exchange

sudo -u litho /usr/local/bin/lithod-mainnet-9005 init exchange-node-01 \
  --chain-id lithosphere_9005-1 \
  --home "$LITHO_HOME"

sudo -u litho curl --fail --silent --show-error --location \
  https://rpc-mainnet.litho.ai/genesis.json \
  --output "$LITHO_HOME/config/genesis.json"

echo '13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f  /var/lib/litho-mainnet-9005-exchange/config/genesis.json' \
  | sha256sum --check

/usr/local/bin/lithod-mainnet-9005 validate-genesis \
  "$LITHO_HOME/config/genesis.json"
```

`init` creates local node identity files. Those are not the network validator's
consensus key. Never copy a validator `priv_validator_key.json` or signing state
onto an exchange node.

## 6. Configure P2P and RPC

Edit `$LITHO_HOME/config/config.toml`.

Required identity and peer settings:

```toml
moniker = "exchange-node-01"
db_backend = "goleveldb"
db_dir = "data"

[rpc]
laddr = "tcp://127.0.0.1:26657"
unsafe = false

[p2p]
laddr = "tcp://0.0.0.0:26656"
external_address = ""
seeds = ""
persistent_peers = "76cadd27f507c401f58c1335c3f5ece39412f179@31.97.39.146:27056,94aa07934bc0614134056bcfe90feb0d214a6e66@72.60.177.106:27056"
pex = true

[tx_index]
indexer = "kv"

[instrumentation]
prometheus = true
prometheus_listen_addr = "127.0.0.1:26660"
```

If inbound P2P is enabled behind NAT, forward TCP `26656` and set
`external_address = "PUBLIC_IP:26656"`. Outbound-only P2P works without it.

Do not change consensus timeout settings on a non-validator unless directed by
a coordinated network release. Do not enable state sync without a project-
published trust height, trust hash, and compatible snapshot service.

## 7. Configure application APIs and storage

Edit `$LITHO_HOME/config/app.toml`:

```toml
minimum-gas-prices = "0.0001ulitho"
pruning = "default"
pruning-keep-recent = "0"
pruning-interval = "0"

[api]
enable = true
swagger = false
address = "tcp://127.0.0.1:1317"
enabled-unsafe-cors = false

[grpc]
enable = true
address = "127.0.0.1:9090"

[json-rpc]
enable = true
address = "127.0.0.1:8545"
ws-address = "127.0.0.1:8546"
api = "eth,net,web3"
allow-unprotected-txs = false
enable-indexer = false

[memiavl]
enable = true
```

For archive application state, use `pruning = "nothing"` and provision more
disk. CometBFT block and transaction-index databases still grow separately.
The exchange must maintain its own address/deposit index even on an archive
node.

MemIAVL must remain enabled to match the live chain. Do not copy storage
settings from an older Makalu/Kamet guide.

## 8. Install systemd service

Create `/etc/systemd/system/lithod-mainnet-9005-exchange.service`:

```ini
[Unit]
Description=LITHO Mainnet 9005 Exchange Full Node
After=network-online.target
Wants=network-online.target

[Service]
User=litho
Group=litho
Type=simple
ExecStart=/usr/local/bin/lithod-mainnet-9005 start --home /var/lib/litho-mainnet-9005-exchange
Restart=on-failure
RestartSec=5
LimitNOFILE=1048576
TimeoutStopSec=90
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
```

Activate it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lithod-mainnet-9005-exchange
sudo journalctl -u lithod-mainnet-9005-exchange -f
```

## 9. Synchronization

No approved public snapshot is available. Genesis/block sync is the supported
bootstrap path at this time.

```bash
curl -fsS http://127.0.0.1:26657/status | jq '{
  network: .result.node_info.network,
  height: .result.sync_info.latest_block_height,
  block_time: .result.sync_info.latest_block_time,
  catching_up: .result.sync_info.catching_up
}'

curl -fsS http://127.0.0.1:26657/net_info | jq '.result.n_peers'
```

Synchronization is complete only when:

- network is `lithosphere_9005-1`;
- height is close to two independent remote endpoints;
- `catching_up` is `false`;
- latest block time is current; and
- the height advances across repeated samples.

## 10. Exchange acceptance checks

```bash
# EVM chain ID: expected 0x232d
curl -fsS http://127.0.0.1:8545 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'

# Latest height
curl -fsS http://127.0.0.1:8545 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'

# Local genesis and binary integrity
sha256sum /var/lib/litho-mainnet-9005-exchange/config/genesis.json
sha256sum /usr/local/bin/lithod-mainnet-9005

# Public comparison
curl -fsS https://rpc-mainnet.litho.ai/status | jq '.result.sync_info'
```

Before opening deposits, also test account derivation, native deposits,
LEP100 log detection, withdrawal signing, nonce recovery, service restart,
database restore, alert routing, and idempotent replay from an earlier height.

## 11. Backup and recovery

Back up:

- `config/node_key.json` if stable node identity matters;
- configuration and service files;
- the exchange deposit-index database;
- wallet derivation metadata and custody policies through the HSM/MPC system;
- exact binary, source release reference, genesis, and checksums.

Do not treat the node `data/` directory as a wallet-key backup. A non-validator
node may be rebuilt from an approved snapshot or genesis. Never use
`unsafe-reset-all` without a reviewed rebuild plan and a verified accounting
checkpoint.

## 12. Operational alerts

Page on:

- no new block for more than two minutes;
- `catching_up=true` after initial sync;
- chain-ID or genesis mismatch;
- local/public canonical block-hash mismatch;
- zero peers or both official peers unavailable;
- disk over 80%, file descriptors, memory pressure, or restart loop;
- RPC latency/error-rate threshold breach;
- pending withdrawal nonce gap; and
- certificate expiry for any proxy operated by the exchange.

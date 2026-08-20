# Validator node deployment

Use this guide for LITHO Mainnet only. The full intake, staking, commission,
activation, and acceptance process is in
[LITHO mainnet validator onboarding](onboarding.md).

## Approved network values

| Item | Value |
| --- | --- |
| Cosmos chain ID | `lithosphere_9005-1` |
| EVM chain ID | `9005` |
| Bond denomination | `ulitho` (18 decimals) |
| Genesis URL | `https://rpc-mainnet.litho.ai/genesis.json` |
| Genesis SHA-256 | `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` |
| Public CometBFT RPC | `https://rpc-mainnet.litho.ai` |
| Public REST/LCD | `https://api-mainnet.litho.ai` |

Do not use Makalu chain IDs, genesis files, peers, snapshots, or binaries for
a mainnet validator.

## Host baseline

| Resource | Minimum | Recommended |
| --- | ---: | ---: |
| Linux | Supported 64-bit release | Ubuntu LTS, x86-64 |
| CPU | 8 vCPU | 8+ dedicated vCPU |
| RAM | 24 GB | 32 GB |
| Storage | 300 GB free NVMe | 500+ GB NVMe with growth alerts |
| Network | 100 Mbps | Stable 1 Gbps |

Use a private validator behind at least two independently operated sentries.
The validator should accept P2P traffic only from approved sentries. Bind RPC,
REST, gRPC, EVM RPC/WebSocket, metrics, and administration to loopback or a
protected network.

## Binary and initialization

Obtain `lithod-mainnet-9005` from the KaJ Labs-approved release channel. No
public binary URL is currently approved. Stop unless the binary SHA-256 is:

```text
0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c
```

```bash
sha256sum ./lithod-mainnet-9005
sudo install -o root -g root -m 0755 ./lithod-mainnet-9005 \
  /usr/local/bin/lithod-mainnet-9005

sudo useradd --system --home-dir /var/lib/litho-mainnet-9005-val \
  --shell /usr/sbin/nologin litho
sudo install -d -o litho -g litho -m 0750 \
  /var/lib/litho-mainnet-9005-val
sudo -u litho /usr/local/bin/lithod-mainnet-9005 init \
  <MONIKER> --chain-id lithosphere_9005-1 \
  --home /var/lib/litho-mainnet-9005-val
```

## Genesis verification

```bash
curl -fsS https://rpc-mainnet.litho.ai/genesis.json \
  -o /tmp/litho-mainnet-genesis.json
printf '%s  %s\n' \
  '13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f' \
  /tmp/litho-mainnet-genesis.json | sha256sum --check
sudo install -o litho -g litho -m 0640 \
  /tmp/litho-mainnet-genesis.json \
  /var/lib/litho-mainnet-9005-val/config/genesis.json
```

Stop if the checksum or embedded chain ID differs.

## Keys and double-sign prevention

- The operator account signs staking transactions.
- `node_key.json` identifies the P2P node.
- `priv_validator_key.json` is the consensus signing identity.
- `priv_validator_state.json` prevents signing conflicting heights during a
  restore or migration.

Use an approved remote signer or HSM where available. Otherwise restrict the
consensus key to the service account and maintain at least two encrypted,
offline backups under independent custody. Never start the same consensus key
on two hosts.

Record only public identities:

```bash
sudo -u litho /usr/local/bin/lithod-mainnet-9005 tendermint show-validator \
  --home /var/lib/litho-mainnet-9005-val
sudo -u litho /usr/local/bin/lithod-mainnet-9005 tendermint show-node-id \
  --home /var/lib/litho-mainnet-9005-val
```

## Peering and synchronization

Use only coordinator-approved peers. A private validator normally disables
peer exchange and connects only to its sentries:

```toml
[rpc]
laddr = "tcp://127.0.0.1:26657"
unsafe = false

[p2p]
laddr = "tcp://0.0.0.0:26656"
pex = false
persistent_peers = "<SENTRY_NODE_ID>@<SENTRY_HOST>:<PORT>"

[instrumentation]
prometheus = true
prometheus_listen_addr = "127.0.0.1:26660"
```

Start with the approved systemd or Cosmovisor service. Do not activate the
consensus key or submit a staking transaction until the node has peers,
matches public height, and reports `catching_up: false`.

```bash
curl -fsS http://127.0.0.1:26657/status
curl -fsS https://rpc-mainnet.litho.ai/status
```

## Registration and operation

Registration uses one independently reviewed `create-validator` transaction.
The exact stake, commission rate/maximum/daily change, minimum
self-delegation, simulated gas, fee, funding, and UTC window must be approved
first. Follow the transaction procedure and acceptance checklist in
[mainnet onboarding](onboarding.md).

After activation, continuously monitor signing, peers, height, finality, disk,
memory, clock drift, missed blocks, and service restarts. Maintain primary and
backup responders. Test upgrades and restores without cloning a live signer.

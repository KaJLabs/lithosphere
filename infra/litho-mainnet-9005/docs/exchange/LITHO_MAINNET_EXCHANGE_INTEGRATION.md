# LITHO Mainnet Exchange Integration Package

Last reviewed: 2026-07-29

Document status: **technical draft complete; external submission gated**. The
base chain and node APIs are live. The production explorer, public binary
release URL, public snapshot URL, approved mainnet LEP100 registry, formal
deposit-confirmation policy, and confirmed mainnet wallet support must be
closed before this package is represented as a final exchange listing pack.

This is the master response for exchanges integrating the native LITHO coin
and LEP100 fungible tokens. Detailed implementation guidance is provided in:

- [Exchange node installation](MAINNET_EXCHANGE_NODE_GUIDE.md)
- [Exchange API reference](MAINNET_EXCHANGE_API_REFERENCE.md)
- [LEP100 integration](LEP100_EXCHANGE_INTEGRATION.md)
- [External release checklist](EXCHANGE_DOCUMENTATION_RELEASE_CHECKLIST.md)

## Exchange quick reference

| Field | Value |
|---|---|
| Network | Lithosphere Mainnet |
| Native coin name | Lithosphere |
| Native coin symbol | `LITHO` |
| Base denomination | `ulitho` |
| Decimal precision | 18; `1 LITHO = 10^18 ulitho` |
| Cosmos chain ID | `lithosphere_9005-1` |
| EVM chain ID | `9005` (`0x232d`) |
| Consensus | CometBFT proof of stake; not proof of work |
| Account model | Account-based; not UTXO |
| Genesis SHA-256 | `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` |
| Approved binary SHA-256 | `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c` |
| Genesis URL | `https://rpc-mainnet.litho.ai/genesis.json` |
| EVM JSON-RPC | `https://rpc-mainnet.litho.ai` |
| EVM WebSocket | `wss://rpc-mainnet.litho.ai/websocket` |
| Cosmos REST | `https://api-mainnet.litho.ai` |
| gRPC | `grpc-mainnet.litho.ai:9090` |
| Read-only CometBFT RPC | `https://rpc-mainnet.litho.ai/status` and allowlisted query routes |
| Explorer | `https://lithoscan.ai`; production cutover accepted 2026-07-31 |
| Public P2P peers | Obtain the current peer list from the KaJ Labs operator-maintained peer registry; do not pin historical origin addresses. |
| Fixed native supply | `1,000,000,000 LITHO` |
| Measured block interval | 0.525 seconds average over heights 177439–178439 on 2026-07-29 |

## Integration position

For exchange custody, the recommended primary integration is the EVM interface:

- use `0x` deposit addresses;
- sign EIP-155 transactions with chain ID `9005`;
- maintain amounts as integer base units with 18 decimals;
- detect native deposits from canonical blocks and successful receipts;
- detect LEP100 deposits from the exact allowlisted contract's `Transfer` logs;
- operate an internal full node and deposit indexer; and
- keep node RPC private even if P2P is public.

Cosmos `litho1...` accounts map to the same 20-byte account space, but an
exchange should not mix EVM and Bech32 deposit formats unless it has explicitly
tested conversion, signing, accounting, and withdrawal behavior for both.

## Numbered exchange questionnaire response

### 2. Digital coin name and abbreviation

Name: **Lithosphere**. Abbreviation and native ticker: **LITHO**.

### 3. Block explorer address

The production mainnet explorer is `https://lithoscan.ai`. Its public cutover,
chain-identity checks, smoke tests, synchronization monitoring, and rollback
closeout passed on 2026-07-31. Do not submit a testnet explorer as the mainnet
explorer.

### 4. GitHub address

Current infrastructure/source repository:
`https://github.com/BrewCodeDev/lithosphere-dev-infra`.

Repository access may be restricted. A public, immutable release/tag containing
the mainnet binary source, fixed-supply patch, genesis, build instructions, and
checksums is an external-submission gate.

### 5. Node installation documents

See [MAINNET_EXCHANGE_NODE_GUIDE.md](MAINNET_EXCHANGE_NODE_GUIDE.md). It covers
binary verification, genesis installation, peer configuration, ports,
systemd, synchronization, and health checks.

### 6. Required disk size

Recommended production specification for an exchange wallet node:

| Node profile | CPU | RAM | Disk |
|---|---:|---:|---:|
| Pruned full node plus external deposit indexer | 8 vCPU | 32 GiB | 500 GB NVMe SSD |
| Archive/historical-state node | 8–16 vCPU | 32–64 GiB | Start at 1 TB NVMe and monitor growth |

These are capacity recommendations, not a fixed protocol minimum. The chain is
new and disk growth is workload-dependent. Keep at least 30% free space and
alert at 70%, 80%, and 90% utilization.

### 7. Mainnet block data or snapshots

No public, checksum-pinned mainnet data snapshot URL is approved at this time.
The canonical genesis is available at:
`https://rpc-mainnet.litho.ai/genesis.json`.

Until an official snapshot is published, initialize from genesis and block-sync
from the two public peers. Never use a Makalu, Kamet, AWS, or third-party
snapshot for `lithosphere_9005-1`.

### 8. Block production rate

A live 1,000-block sample from height `177439` to `178439`, collected on
2026-07-29, averaged **0.525 seconds per block** with a median of **0.525
seconds**. Treat `~0.5 seconds` as the observed operating interval, not a
permanent protocol guarantee.

### 9. Transaction precision

Native LITHO has 18 decimals. The smallest unit is:

`0.000000000000000001 LITHO = 1 ulitho`.

Store and calculate amounts as integers in `ulitho`; never use binary floating
point. LEP100 decimals are contract-specific and must be queried using
`decimals()` for every listed contract. The reference LEP100 implementation
recommends 18 decimals but does not force it.

### 10. Public API URL

- EVM JSON-RPC: `https://rpc-mainnet.litho.ai`
- EVM WebSocket: `wss://rpc-mainnet.litho.ai/websocket`
- Cosmos REST: `https://api-mainnet.litho.ai`
- gRPC TLS: `grpc-mainnet.litho.ai:9090`
- Read-only CometBFT status: `https://rpc-mainnet.litho.ai/status`

Public endpoints are rate-limited and should not be the exchange's sole wallet
backend. Operate a private full node for production deposits and withdrawals.

### 11. Memo support

Cosmos transactions support a transaction memo of up to **256 characters**.
Ethereum-style native transfers and LEP100 transfers do not have a standardized
exchange memo/tag field. EVM transaction `data` must not be treated as a
portable deposit memo.

Recommended exchange design: allocate a unique `0x` deposit address per user.
Only offer memo-based Cosmos deposits if that separate flow has been fully
implemented and tested.

### 12. Creating accounts

The chain is account-based and does not require an on-chain account-creation
transaction. Generate a secp256k1 key securely offline; the 20-byte public-key
derived address becomes usable immediately and appears on chain after its first
transaction or balance. Use an HSM/MPC custody platform for exchange keys.

Examples and address rules are in the API and node guides. Never send seed
phrases or private keys to a node, explorer, support channel, or API.

### 13. Configuration-file directory

For the recommended exchange deployment:

```text
/var/lib/litho-mainnet-9005-exchange/
├── config/
│   ├── app.toml
│   ├── client.toml
│   ├── config.toml
│   ├── genesis.json
│   └── node_key.json
└── data/
```

The home is selected with `--home`. An exchange full node does not need a
validator consensus key.

### 14. Customizing RPC ports and block-data directory

Set the node home with `--home /path`. Configure:

- CometBFT RPC: `[rpc].laddr` in `config/config.toml`;
- P2P: `[p2p].laddr` in `config/config.toml`;
- CometBFT database: top-level `db_dir` in `config/config.toml`;
- REST: `[api].address` in `config/app.toml`;
- gRPC: `[grpc].address` in `config/app.toml`;
- EVM HTTP/WS: `[json-rpc].address` and `ws-address` in `config/app.toml`.

Bind wallet APIs to loopback or a private network. Expose only P2P externally.

### 15. RPC and SDK documentation

Project-specific examples: [MAINNET_EXCHANGE_API_REFERENCE.md](MAINNET_EXCHANGE_API_REFERENCE.md).

Upstream interfaces:

- Ethereum JSON-RPC: `https://ethereum.org/developers/docs/apis/json-rpc/`
- ethers v6: `https://docs.ethers.org/v6/`
- Cosmos SDK v0.50 transactions: `https://docs.cosmos.network/sdk/v0.50/learn/advanced/transactions`
- CometBFT v0.38 RPC: `https://docs.cometbft.com/v0.38/spec/rpc/`
- OpenZeppelin ERC20: `https://docs.openzeppelin.com/contracts/5.x/api/token/erc20`

### 16. API instructions

See [MAINNET_EXCHANGE_API_REFERENCE.md](MAINNET_EXCHANGE_API_REFERENCE.md) for
copyable requests, response conditions, and LEP100 log decoding.

#### 16.1 Account validation

For EVM deposits, validate a strict 20-byte hex address (`0x` plus 40 hex
characters), reject the zero address, and use an EIP-55-aware address library.
Optionally call `eth_getCode`; `0x` indicates an externally owned address at
that block, while non-empty code indicates a contract.

For Cosmos addresses, decode Bech32, require HRP `litho`, and require a 20-byte
payload. Do not accept `lithovaloper...` validator-operator addresses as normal
deposit addresses.

#### 16.2 Best-height API

- EVM: `eth_blockNumber`
- CometBFT: `GET https://rpc-mainnet.litho.ai/status` and read
  `result.sync_info.latest_block_height`
- Private REST node: `GET /cosmos/base/tendermint/v1beta1/blocks/latest`

#### 16.3 Account-history API

Standard EVM JSON-RPC has no reliable "all transactions by address" method.
The exchange must index blocks, receipts, and token logs into its own database.
`eth_getLogs` is suitable for allowlisted LEP100 contracts in bounded ranges.

Cosmos transactions can be queried by hash through
`/cosmos/tx/v1beta1/txs/{hash}` and by indexed events on a private node.
Lithoscan is available for public browsing and secondary verification, but an
exchange must operate its own node and indexer for production accounting.

#### 16.4 Detailed transaction information

For EVM transactions, query both `eth_getTransactionByHash` and
`eth_getTransactionReceipt`. Also load the referenced block with
`eth_getBlockByNumber` or `eth_getBlockByHash` and verify its hash.

For Cosmos transactions, query `/cosmos/tx/v1beta1/txs/{hash}` and require
`tx_response.code == 0`.

#### 16.5 Preventing fraudulent or incorrect deposit credit

Never credit from a pending transaction, calldata alone, or an explorer page.

For native LITHO:

1. Require chain ID `9005` from the node.
2. Fetch the transaction and receipt independently.
3. Require receipt `status == 0x1`.
4. Require the transaction `to` to equal the assigned deposit address.
5. Decode `value` as an integer number of `ulitho`.
6. Fetch the canonical block and require its hash to equal the receipt's
   `blockHash` and that it contains the transaction hash.
7. Wait for the approved operational confirmation count and ensure the chain
   continues advancing.
8. Credit idempotently by `(chain_id, transaction_hash)`.

For LEP100:

1. Require the exact allowlisted mainnet token contract address.
2. Require a successful receipt and canonical block as above.
3. Find a `Transfer(address,address,uint256)` log emitted by that contract.
4. Require the indexed `to` topic to equal the assigned deposit address.
5. Decode the log's `value` using that contract's confirmed decimals.
6. Credit idempotently by `(chain_id, transaction_hash, log_index)` because one
   transaction can emit multiple transfers.

An exchange-operated node should be compared with at least one independent
public endpoint. Pause deposits automatically on chain-ID mismatch, stale
height, conflicting block hash, or validator/consensus alerts.

#### 16.6 Offline signing and online broadcast

Recommended EVM flow:

1. Online system obtains `nonce`, fee data, destination, amount, and gas limit.
2. Offline/HSM system validates chain ID `9005`, destination, amount, nonce,
   and policy; it then signs the complete EIP-155 transaction.
3. Only the signed raw bytes return online.
4. Online system broadcasts with `eth_sendRawTransaction`.
5. Track the returned hash through receipt inclusion and the deposit/withdrawal
   finality policy.

The private key never reaches the RPC node. See the API reference for an ethers
v6 example and a Cosmos `SIGN_MODE_DIRECT` alternative.

#### 16.7 Account balance API

- Native EVM balance: `eth_getBalance(address, "latest")`
- Native Cosmos balance:
  `/cosmos/bank/v1beta1/balances/{litho_address}/by_denom?denom=ulitho`
- LEP100 balance: `eth_call` to `balanceOf(address)` on the exact token contract

All returned values are base-unit integers.

### 17. Measures to prevent chain forks

- pin chain ID, genesis checksum, and reviewed binary checksum;
- connect to both official sentries and compare against an independent RPC;
- run NTP/time synchronization and monitor peers, height, and block hashes;
- never reuse a validator consensus key or validator signing state on an
  exchange node;
- keep the node binary and configuration under change control;
- halt deposits on conflicting canonical hashes or stalled consensus; and
- follow coordinated network-upgrade notices before changing binaries.

CometBFT provides deterministic BFT finality, not longest-chain PoW finality.
However, the current mainnet validator set contains one validator, so the
exchange must treat operator compromise or catastrophic recovery as an
additional governance/operational risk.

### 18. Account restore and recovery recommendations

- Use HSM/MPC or offline encrypted seed custody with dual control.
- Back up derivation metadata, account inventory, signing policies, and address
  mappings separately from node data.
- Test recovery with a watch-only environment before enabling withdrawals.
- Restore accounts from keys; restore node state from an approved snapshot or
  resync. Node data is not the source of account ownership.
- Never restore a validator key or `priv_validator_state.json` onto an exchange
  node.
- Reconcile all deposit addresses and balances after recovery before reopening
  withdrawals.

### 19. Coin symbol

`LITHO`.

### 20. Officially recognized wallet

Thanos Wallet is the Lithosphere ecosystem wallet at `https://thanos.fi`, and
MetaMask-compatible wallets can add EVM chain `9005` manually. At the time of
this draft, Thanos' public material identifies Makalu rather than the new
`9005` mainnet, so mainnet support must be explicitly confirmed before the
wallet is submitted to an exchange as production-ready.

Manual EVM configuration:

```text
Network name: Lithosphere Mainnet
RPC URL: https://rpc-mainnet.litho.ai
Chain ID: 9005
Currency symbol: LITHO
Explorer: https://lithoscan.ai
```

### 21. Same currency on other networks and bridge audit

No cross-chain representation of mainnet `9005` LITHO or LEP100 token is
approved for exchange listing in this package. MultX, Bridge, and Swap remain
disabled on mainnet. The repository contains an audit RFQ and internal test
evidence, not a completed independent bridge audit report. Therefore there is
no bridge-audit link that can responsibly be supplied yet.

Do not treat any Makalu/Kamet token, old wLITHO contract, or destination-chain
wrapped asset as interchangeable with mainnet LITHO.

### 22. PoW and 51% attack

Not applicable. Lithosphere mainnet uses proof-of-stake CometBFT consensus, not
proof of work. There are no miners or top-five miner addresses. The current
validator set can be queried from `https://rpc-mainnet.litho.ai/validators`;
at the time of review it contained one validator.

### 23. Common transfer types

- EVM native LITHO transfer (`value` transfer)
- Cosmos bank `MsgSend`
- Cosmos bank `MsgMultiSend`
- LEP100 `transfer(address,uint256)`
- LEP100 `transferFrom(address,address,uint256)` after allowance

The reference LEP100 contract has no standard `batch`, `batchAll`, reflection,
fee-on-transfer, rebase, or proxy-upgrade behavior. Exchanges must still review
each exact contract they list.

### 24. Rollback and irreversible blocks

Committed CometBFT blocks have deterministic finality and do not normally
experience probabilistic reorganizations. There is no protocol concept of
"safe after N PoW blocks." Operationally, exchanges should still wait a
confirmation buffer and watch continued height advancement.

Provisional integration recommendation: **20 blocks** for normal deposits and
**100 blocks** for high-value deposits until the client and exchange approve a
formal policy. At the measured rate, those are roughly 10.5 and 52.5 seconds.
These values are recommendations, not yet an officially signed listing policy.

### 25. Transaction-pool timeout

The deployed configuration does not set a time-based mempool TTL. A valid
transaction may remain pending until included, invalidated during recheck,
replaced according to nonce/fee rules, evicted by capacity pressure, or removed
when the node restarts. Exchange systems must implement their own pending
timeout, nonce reconciliation, safe rebroadcast, and replacement policy.

### 26. Rent or minimum account reservation

There is no account rent, storage rent, or mandatory minimum balance for an
ordinary EVM/Cosmos account. Users only need sufficient LITHO to pay transaction
fees. Staking and governance actions have their own amounts but do not impose a
general account reserve.

### 27. UTXO failure determination

Not applicable. Lithosphere is account-based. Validate nonce/sequence, balance,
gas, fee, destination, chain ID, signature, and—when calling a contract—the
simulation result. For LEP100 withdrawals, also validate token balance and
allowance when `transferFrom` is used.

### 28. Mainnet transfer start time

The sealed height-1 timestamp is `2026-07-27T17:00:00Z`; continuous live block
production began at height 2 on `2026-07-28T04:26:52.822404135Z`. Native
transfers are technically enabled by the chain.

The official exchange deposit/withdrawal opening time is **TBD** and should be
announced only after the explorer, monitoring, confirmation policy, wallet
testing, and exchange release checklist are approved.

### 29. Must a wallet node expose a port? Is NAT acceptable?

The wallet's RPC, REST, gRPC, EVM, and metrics ports should remain private.
Only the P2P port needs network connectivity. Outbound-only P2P can synchronize,
so NAT is acceptable. For stable inbound peer connectivity, forward one TCP
P2P port and configure the advertised external address. Never port-forward the
custody RPC directly to the Internet.

### 30. Address rules

| Address type | Rule |
|---|---|
| EVM account/contract | `0x` plus 40 hexadecimal characters; total length 42; 20-byte payload; EIP-55 checksum recommended |
| Cosmos account | Bech32 HRP `litho`; typical length 44; decoded payload must be 20 bytes |
| Validator operator | Bech32 HRP `lithovaloper`; not a normal exchange deposit address |

Reject malformed mixed-case EVM checksums, the zero address, wrong Bech32 HRP,
wrong payload length, and all addresses from other networks.

### 31. Node-IP whitelist for synchronization

No node-IP whitelist is required for normal mainnet P2P synchronization. Use
the two published persistent peers. If an exchange requests a dedicated peer
or higher service level, coordinate it separately; do not expose custody RPC
or ask for a validator private peer.

### 32. Community notice regarding MEXC deposit addresses

Lithosphere is not mined, so "mining deposit" is not applicable. The community
notice should state:

> Do not use a MEXC or any other exchange deposit address for validator
> rewards, staking ownership, token distribution contracts, faucets,
> mining-like payouts, or long-term custody. Send only the exact asset on the
> exchange-supported Lithosphere network after deposits are officially open.
> Unsupported networks, tokens, or operational payouts may not be credited or
> recoverable.

## External references

- Ethereum JSON-RPC: `https://ethereum.org/developers/docs/apis/json-rpc/`
- ethers v6: `https://docs.ethers.org/v6/`
- Cosmos SDK v0.50 transactions:
  `https://docs.cosmos.network/sdk/v0.50/learn/advanced/transactions`
- CometBFT v0.38 RPC: `https://docs.cometbft.com/v0.38/spec/rpc/`
- CometBFT production guidance:
  `https://docs.cometbft.com/v0.38/core/running-in-production`
- OpenZeppelin ERC20:
  `https://docs.openzeppelin.com/contracts/5.x/api/token/erc20`

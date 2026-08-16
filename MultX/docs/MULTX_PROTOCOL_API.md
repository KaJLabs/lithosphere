# Multx Protocol — Swap Integration API Specification

**Version**: 1.0.0
**Network**: Lithosphere Makalu (Chain ID: `lithosphere_777777-1` / EVM: `777777`)
**Last Updated**: March 10, 2026

---

## 1. Overview

Multx is the native token swap protocol on Lithosphere. It enables trustless token exchanges through on-chain liquidity pools using an automated market maker (AMM) model. This document specifies the API endpoints, request/response formats, and integration patterns for developers building on top of Multx.

### Base URLs

| Network | Base URL |
|---------|----------|
| **Kamet (mainnet)** | `https://rpc-3.litho.ai` |
| **Makalu (testnet)** | `https://rpc.litho.ai` |

All Multx operations are executed as EVM transactions via JSON-RPC or as Cosmos SDK messages via REST/gRPC.

---

## 2. EVM JSON-RPC Interface

Multx swap contracts are EVM-compatible. Interact using standard `eth_call` / `eth_sendRawTransaction` via JSON-RPC.

### Endpoint

```
POST https://rpc.litho.ai
Content-Type: application/json
```

### 2.1 Get Pool Info

Query a liquidity pool's reserves and pricing.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "eth_call",
  "params": [{
    "to": "<pool_contract_address>",
    "data": "0x0902f1ac"
  }, "latest"],
  "id": 1
}
```

> `0x0902f1ac` = `getReserves()` function selector

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x00000000000000000000000000000000000000000000001b1ae4d6e2ef500000000000000000000000000000000000000000000000000000000000e8d4a5100000000000000000000000000000000000000000000000000000000000067cc1a80"
}
```

**Decoded fields:**
| Field | Type | Description |
|-------|------|-------------|
| `reserve0` | `uint112` | Reserve of token0 in the pool |
| `reserve1` | `uint112` | Reserve of token1 in the pool |
| `blockTimestampLast` | `uint32` | Timestamp of last reserve update |

### 2.2 Get Amount Out (Quote)

Calculate the expected output for a given input amount.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "eth_call",
  "params": [{
    "to": "<router_contract_address>",
    "data": "<encoded_getAmountOut(amountIn, reserveIn, reserveOut)>"
  }, "latest"],
  "id": 2
}
```

**Function signature:** `getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) → uint256 amountOut`

**Selector:** `0x054d50d4`

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": "0x0000000000000000000000000000000000000000000000000000000005f5e100"
}
```

### 2.3 Execute Swap

Submit a signed swap transaction.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "eth_sendRawTransaction",
  "params": ["0x<signed_transaction_hex>"],
  "id": 3
}
```

**Router function signatures:**

| Function | Selector | Description |
|----------|----------|-------------|
| `swapExactTokensForTokens(uint256,uint256,address[],address,uint256)` | `0x38ed1739` | Swap exact input for minimum output |
| `swapTokensForExactTokens(uint256,uint256,address[],address,uint256)` | `0x8803dbee` | Swap up-to input for exact output |
| `swapExactLITHOForTokens(uint256,address[],address,uint256)` | `0x7ff36ab5` | Swap exact LITHO for tokens |
| `swapTokensForExactLITHO(uint256,uint256,address[],address,uint256)` | `0x4a25d94a` | Swap tokens for exact LITHO |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `amountIn` / `amountOut` | `uint256` | Token amount (in smallest unit, 18 decimals) |
| `amountOutMin` / `amountInMax` | `uint256` | Slippage protection bound |
| `path` | `address[]` | Ordered array of token addresses defining the swap route |
| `to` | `address` | Recipient address |
| `deadline` | `uint256` | Unix timestamp — transaction reverts if executed after this |

**Response (transaction hash):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060"
}
```

### 2.4 Check Transaction Receipt

```json
{
  "jsonrpc": "2.0",
  "method": "eth_getTransactionReceipt",
  "params": ["0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060"],
  "id": 4
}
```

**Key response fields:**

| Field | Description |
|-------|-------------|
| `status` | `0x1` = success, `0x0` = reverted |
| `logs` | Emitted events (includes `Swap` event with amounts) |
| `gasUsed` | Gas consumed by the swap |

---

## 3. Cosmos REST API Interface

For native Cosmos SDK token swaps (IBC-compatible assets).

### Base URL

```
https://api.litho.ai
```

### 3.1 Query Pool

```
GET /litho/multx/v1/pool/{pool_id}
```

**Response:**
```json
{
  "pool": {
    "id": "1",
    "token0": {
      "denom": "ulitho",
      "amount": "500000000000000000000"
    },
    "token1": {
      "denom": "ibc/27394FB092D2ECCD56123C74F3...",
      "amount": "1000000000"
    },
    "lp_token": {
      "denom": "multx/pool/1",
      "total_supply": "22360679774997896964"
    },
    "swap_fee": "0.003000000000000000",
    "status": "ACTIVE"
  }
}
```

### 3.2 Query All Pools

```
GET /litho/multx/v1/pools?pagination.limit=100
```

### 3.3 Simulate Swap (Dry Run)

```
POST /litho/multx/v1/simulate_swap
```

**Request body:**
```json
{
  "pool_id": "1",
  "input": {
    "denom": "ulitho",
    "amount": "1000000000000000000"
  },
  "output_denom": "ibc/27394FB092D2ECCD56123C74F3..."
}
```

**Response:**
```json
{
  "output": {
    "denom": "ibc/27394FB092D2ECCD56123C74F3...",
    "amount": "1985024"
  },
  "price_impact": "0.001500000000000000",
  "effective_price": "0.001985024000000000",
  "fee": {
    "denom": "ulitho",
    "amount": "3000000000000000"
  }
}
```

### 3.4 Execute Swap (Cosmos Tx)

```
POST /cosmos/tx/v1beta1/txs
```

**Request body (broadcast):**
```json
{
  "tx_bytes": "<base64_encoded_signed_tx>",
  "mode": "BROADCAST_MODE_SYNC"
}
```

**MsgSwap structure (inside the transaction):**
```json
{
  "@type": "/litho.multx.v1.MsgSwap",
  "sender": "litho1...",
  "pool_id": "1",
  "input": {
    "denom": "ulitho",
    "amount": "1000000000000000000"
  },
  "output_denom": "ibc/27394FB092D2ECCD56123C74F3...",
  "min_output_amount": "1975174"
}
```

---

## 4. gRPC Interface

```
grpc.litho.ai:443
```

### Service Definition

```protobuf
service Query {
  rpc Pool(QueryPoolRequest) returns (QueryPoolResponse);
  rpc Pools(QueryPoolsRequest) returns (QueryPoolsResponse);
  rpc SimulateSwap(SimulateSwapRequest) returns (SimulateSwapResponse);
}

service Msg {
  rpc Swap(MsgSwap) returns (MsgSwapResponse);
  rpc AddLiquidity(MsgAddLiquidity) returns (MsgAddLiquidityResponse);
  rpc RemoveLiquidity(MsgRemoveLiquidity) returns (MsgRemoveLiquidityResponse);
}
```

### Example (grpcurl)

```bash
grpcurl -d '{"pool_id": "1"}' \
  grpc.litho.ai:443 \
  litho.multx.v1.Query/Pool
```

---

## 5. WebSocket — Real-Time Swap Events

```
wss://rpc.litho.ai/websocket
```

### Subscribe to Swap Events

```json
{
  "jsonrpc": "2.0",
  "method": "subscribe",
  "params": {
    "query": "tm.event='Tx' AND message.action='/litho.multx.v1.MsgSwap'"
  },
  "id": 1
}
```

### EVM Swap Event Log

Subscribe to EVM `Swap` events via `eth_subscribe`:

```json
{
  "jsonrpc": "2.0",
  "method": "eth_subscribe",
  "params": ["logs", {
    "topics": ["0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"]
  }],
  "id": 1
}
```

> Topic `0xd78ad95...` = `Swap(address,uint256,uint256,uint256,uint256,address)` event signature.

---

## 6. Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `3` | `execution reverted` | Transaction reverted — check slippage, deadline, or approval |
| `5` | `insufficient funds` | Sender balance too low |
| `11` | `out of gas` | Gas limit too low for the swap path |
| `13` | `insufficient fee` | Transaction fee below minimum |

### Common EVM Revert Reasons

| Revert String | Cause | Fix |
|---------------|-------|-----|
| `INSUFFICIENT_OUTPUT_AMOUNT` | Output below `amountOutMin` | Increase slippage tolerance |
| `EXPIRED` | Block timestamp > deadline | Increase deadline parameter |
| `INSUFFICIENT_LIQUIDITY` | Pool has no liquidity | Check pool reserves first |
| `TRANSFER_FAILED` | Token transfer failed | Check token approval / balance |

---

## 7. Rate Limits

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| `rpc.litho.ai` (JSON-RPC) | 10 req/s per IP | 25 |
| `api.litho.ai` (REST) | 30 req/s per IP | 50 |
| `grpc.litho.ai` | No enforced limit | — |
| WebSocket | 5 subscriptions per connection | — |

---

## 8. Integration Checklist

- [ ] Use mainnet endpoints (`rpc.litho.ai`, `api.litho.ai`) for production
- [ ] Use Kamet (`rpc-3.litho.ai`, `api-3.litho.ai`) for development against mainnet; use Makalu (`rpc.litho.ai`, `api.litho.ai`) for testnet-only experimentation
- [ ] Set appropriate slippage tolerance (recommended: 0.5%–1.0%)
- [ ] Set deadline to `block.timestamp + 300` (5 minutes)
- [ ] Approve token spending before calling swap functions
- [ ] Handle `execution reverted` errors gracefully
- [ ] Subscribe to WebSocket for real-time swap confirmations
- [ ] Respect rate limits — implement exponential backoff on 429 responses

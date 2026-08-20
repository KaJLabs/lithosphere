# Lithoswap V2 Subgraph (Makalu)

Indexes the Lithoswap V2 DEX on Lithosphere Makalu (700777) for pool, price and
volume analytics used by the explorer. It mirrors the pattern of the Kamet DEX
subgraph (self-hosted graph-node on vps2, `subgraph.litho.ai`) but targets our
**V2** contracts — the Kamet subgraph is **v3-shaped** (`sqrtPriceX96`, tick
math) and does not index v2, so this is a v2 fork of that approach, not a copy.

## What it tracks

Reserves, reserve-ratio prices (`token0Price` = token1 per token0), per-token
and per-pair **volume in token units**, swap/mint/burn events, and daily
aggregates (`PairDayData`, `TokenDayData`). **USD pricing is intentionally
omitted** — Makalu has no stablecoin pool to anchor it. When one lands, add a
`Bundle` + derived-ETH pricing (the canonical Uniswap-V2 approach) on top.

## Configure after deploying the DEX

The factory address and start block are placeholders until the DEX is deployed
(`Makalu/contracts/scripts/deploy-dex.ts` writes `deployments/dex-700777.json`).
Fill both in `networks.json` (and/or `subgraph.yaml`):

- `LithoswapV2Factory.address` → the deployed `LithoswapV2Factory`
- `startBlock` → the block the factory was deployed in (avoids scanning genesis)

## Build & deploy

```sh
cd Makalu/contracts/subgraph
npm ci
npm run codegen           # generates ./generated from schema + ABIs
npm run build:makalu      # applies networks.json, compiles the wasm mappings
npm run deploy            # → subgraph.litho.ai (self-hosted graph-node on vps2)
```

`codegen` + `build` are the correctness gate for the AssemblyScript mappings.
CI installs the committed lockfile, rejects dependency-audit findings, and runs
both commands before a subgraph change can merge.

## Consuming from the explorer

Query `https://subgraph.litho.ai/subgraphs/name/litho/lithoswap`. Example — top
pools by tx count with current price:

```graphql
{
  pairs(first: 10, orderBy: txCount, orderDirection: desc) {
    id
    token0 { symbol }
    token1 { symbol }
    reserve0
    reserve1
    token0Price
    volumeToken0
    txCount
  }
}
```

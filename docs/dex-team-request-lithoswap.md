# Lithoswap on Makalu — DEX Integration Facts & Decision

**Re:** native swap DEX on Lithosphere Makalu (700777) for the MultX cross-chain swap.

There is **no external DEX team** — the Kamet DEX is ours. Its source is in the
dev-infra clone at `contracts/dex/` (NOT in this repo). The facts below are the
source of truth answering the original request; only the liquidity call (§4) is
still open.

## Context

We're adding a **native token swap on Makalu** (the DEX leg of the cross-chain
"MultX Swap"). We've built and verified a **Uniswap-V2** DEX ("Lithoswap") in
PR #68. The `/swap` UI is already on `main`; stale conflicting PR #69 was closed
as superseded on 2026-08-16. The Kamet DEX, by
contrast, is a **Uniswap V3 fork** — so "parity with Kamet" would mean switching
Makalu to v3, not shipping what we already have.

## 1. Contracts (Kamet fork)

- **Uniswap V3 fork** (core + periphery). Source + deploy scripts in the
  dev-infra clone: `contracts/dex/` → `scripts/01-deploy-core.js`,
  `02-seed-pools.js`, `03-quote-test.js`.
- v3, so there is **no v2 pair init-code hash**; the periphery is pinned to the
  factory below.

## 2. Deployed Kamet addresses (chain 900523)

From `contracts/dex/deployments/kamet-latest.json`:

| Contract | Address |
|---|---|
| Factory | `0xe6c61Ce7Cc92c732A815250d7c2292eD21F6bf85` |
| SwapRouter | `0x7a067A343e5e94BfDda46df496507eB98c826dA4` |
| Quoter | `0xcC57C38F6225077464a3cdEaE176D212f839Cf3C` |
| NonfungiblePositionManager | `0xB5d58B337128A6aA10494F9cA7cB899A778D00a0` |
| WETH9 / wrapped-native | `0xC0FC628e3aB128fe387e7ed5e729bD809C017888` (= wLITHO on Kamet) |
| Deployer | `0xE9267bDf7084815B0754545049AE45FE744Aefa8` |

## 3. Subgraph

- Source: `contracts/dex/subgraph/` (commit `b7cb1da`). Deployed on vps2 at
  `/opt/dex-subgraph`; public at
  `https://subgraph.litho.ai/subgraphs/name/litho/dex`. Factory `startBlock`
  1961630; event-driven (zero `eth_call`, derives price from `sqrtPriceX96`).
- ⚠️ **Correction to the original ask:** this subgraph is **v3-shaped** (reads
  `sqrtPriceX96`, tick math, v3 pool events). It will **not** index a v2 DEX
  unmodified. If we ship v2, the schema/mappings must be forked to v2 pair
  events — reusable as a *pattern*, not a drop-in.

## 4. Liquidity — the real gate (open)

- Kamet seeded pools (base = wLITHO, 0.3% fee): **wLITHO/QTT, wLITHO/COLLE,
  wLITHO/LitBTC**. Our routing-base plan (everything against wLITHO) matches.
- Seeding **Makalu** pools needs actual token supply + an LP decision: which
  wallet holds the tokens, which pairs, and how much depth. No code delivers
  this — it's the one genuinely open input.

## 5. Frontend / SDK

- v3 quoting is via the **Quoter** (`quoteExactInputSingle`), not v2
  `getAmountsOut`. Adopting the v3 contracts means porting that + the
  NonfungiblePositionManager for LP. Our shipped `lib/swap.ts` / `/swap` are
  built for the v2 `getAmountsOut` path.

## Decision

Two paths:

- **(a) Adopt Kamet's V3 on Makalu** — parity + reuse the subgraph/tooling, but
  it replaces our verified v2 and requires deploying v3 core+periphery to 700777,
  porting quoting to the Quoter, LP to the position manager, and rewriting the
  swap UI. The v3 source would also need to be brought into this repo.
- **(b) Ship our V2** — repository candidate implemented and locally verified,
  but not deployed or funded. The liquidity-seeding script exists
  (`scripts/seed-dex-liquidity.ts`, PR #68). The swap quotes on-chain via
  `getAmountsOut`, so it needs **no** subgraph to function; a v2-adapted
  subgraph is optional (analytics only).

**Recommendation: (b).** Kamet's existing v3 liquidity does not carry to Makalu —
a Makalu-native swap needs fresh Makalu pools regardless of codebase — so v3 buys
no faster path to a live swap, only cross-chain codebase parity. Pick (a) only if
one shared DEX codebase across chains is a hard requirement.

## Repository review status (2026-08-16)

PR #68 was rebased onto current `main` and hardened during review. The reviewed
repository slice now has:

- nonzero factory fee-controller and router immutable-address checks;
- one-time, valid-token pair initialization checks;
- a versioned deployment manifest with transaction, block, commit, controller,
  and runtime-code-hash evidence;
- an explicit expected-chain and chain-bound confirmation gate with no default
  WLITHO address;
- read-only-first liquidity preflight, exact approved initial ratios, contract
  code/metadata checks, and separate execution confirmation;
- a read-only post-deployment verifier;
- 28 passing Hardhat tests, including 23 DEX/configuration tests, plus all nine
  independent DEX E2E checks;
- strict TypeScript validation and Slither analysis with zero reported
  detectors.

The package has no production runtime dependencies. Its local Hardhat/testing
toolchain does have known transitive advisories (109 advisories in the
2026-08-16 workspace audit: 1 critical, 55 high, 43 moderate, 10 low). Those
tools must run only in a hardened, ephemeral CI/deployment runner with trusted
inputs until the toolchain is modernized; they are not part of deployed DEX
bytecode. This internal review is not a substitute for an independent contract
audit.

The V2 router supports standard ERC-20/LEP100 behavior only. Fee-on-transfer,
rebasing, callback-bearing, or otherwise nonstandard assets are not approved
without separate testing and review.

**Remaining for (b):** independent contract-owner/auditor acceptance, the §4
liquidity decision, named fee controller and LP recipient, an approved deployment
window, then deploy → independently verify → seed → perform bounded live tests
→ set `NEXT_PUBLIC_SWAP_ROUTER` through the controlled promotion flow. Swap
must remain disabled until every live acceptance gate passes. Optional: fork the
subgraph to V2 for explorer pool/volume analytics.

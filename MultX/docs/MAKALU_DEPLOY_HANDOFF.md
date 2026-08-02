# Makalu MultX Bridge — Deploy Handoff (for the Makalu dev)

> Goal: deploy the MultXBridge on **Makalu (EVM chainId 700777)** and register
> the 10 Makalu LEP100 tokens. This is the **lock side** and is route-independent
> — you can run it now, regardless of which destination chain is chosen.
> After you send back the deployed bridge address, the infra team wires the
> bridge-api backend + ships the `@litho/multx-sdk` Makalu preset.

> ⛔ **The ONLY thing to run for this task is the hardhat script below**
> (`contracts/scripts/deploy-makalu-bridge.js`). It is a pure on-chain contract
> deploy on 700777 — it touches **no servers, no nginx, no Sentry-1, no certbot**.
>
> **Do NOT run `ansible/playbooks/deploy-bridge.yml` or use `.env.bridge.example`.**
> Those are stale pre-VPS-migration scaffolding (mock validators, AWS Indexer
> 10.0.10.16, Sentry-1 nginx rewrite, dead chain id `lithosphere_700777-1`). The
> live bridge-api already runs on **vps2** (`/opt/bridge`) with **real KMS
> multisig** signing and is served at `bridge.litho.ai` — running that playbook
> would regress it and risk the Sentry-1 nginx. The bridge **backend** does not
> need redeploying for Makalu; only the on-chain contract + a later backend
> config edit (done by infra) are needed.

## Why this is needed

Makalu currently has **no MultX bridge** — `bridge.litho.ai/chains` reports
700777 with an empty bridge, and the backend config (`bridge-api/src/config.js`)
lists Makalu as a placeholder (`bridge:''`, not in `chainsToWatch`). The SDK is
already network-agnostic; the only blocker to a Makalu preset is a deployed
bridge address.

## Prerequisites

- Node + the repo's `contracts/` deps installed (`cd contracts && npm install`).
- `DEPLOYER_PRIVATE_KEY` for an account funded on Makalu. The canonical LEP100
  deployer `0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF` held **500 LITHO** on
  Makalu on 2026-06-16 (plenty; deploy + 10 `addSupportedToken` txs cost well
  under 1 LITHO). Key lives in `contracts/.env` as `DEPLOYER_PRIVATE_KEY`.
- Validator signing addresses. **Recommended: reuse the Kamet hardened set**, so
  the existing bridge-api / KMS multisig can sign Makalu releases with zero new
  key custody.

  > ⚠️ **CORRECTION (2026-06-17): the validator set below is STALE.** The
  > original deploy used the 3 addresses from the old `kamet-bridge-hardened`
  > record, but the live Kamet bridge + bridge-api signer was since rotated to a
  > **7-key KMS set, threshold 5** — with zero overlap. `releaseTokens` reverts
  > on any non-validator signature, so Makalu releases fail until the set
  > matches. **The deployed Makalu bridge has already been corrected via
  > `scripts/fix-makalu-validator-set.js`** (mirrors the live Kamet set). For any
  > FUTURE redeploy, do NOT use the 3 addresses below — instead read the live
  > set: `getValidators()` on the Kamet bridge `0x3a896BDF…F263`, and pass those
  > with threshold 5.

  Stale (do not reuse):
  ```
  VALIDATOR_0_ADDRESS=0xA5BD41d5325A0462873c813D9f377f6C8BE52DEd
  VALIDATOR_1_ADDRESS=0xDC3cB79A773617f24dF1FB249D38E59b91Fa2B0D
  VALIDATOR_2_ADDRESS=0x94625372007f90ebB570E363de57d3a5340C27de
  ```

## Run

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0x... \
VALIDATOR_0_ADDRESS=0xA5BD41d5325A0462873c813D9f377f6C8BE52DEd \
VALIDATOR_1_ADDRESS=0xDC3cB79A773617f24dF1FB249D38E59b91Fa2B0D \
VALIDATOR_2_ADDRESS=0x94625372007f90ebB570E363de57d3a5340C27de \
npx hardhat run scripts/deploy-makalu-bridge.js --network litho_makalu
```

The script guards on `chainId == 700777`, deploys, registers all 10 tokens, and
writes `contracts/deployments/makalu-bridge-latest.json`.

## Tokens registered (Makalu 700777, verified on-chain 2026-06-16)

| | Address |
|---|---|
| wLITHO | `0x599a7E135f1790ae117b4EdDc0422D24Bc766161` |
| LitBTC | `0xC4645CA5411D6E27556780AB4cdd0DF7e609df74` |
| LAX | `0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d` |
| JOT | `0xEF2f35f6d0fb7DC9E87b8ca8252AE2E6ffb2a25e` |
| COLLE | `0x10D4BB600c96e9243E2f50baFED8b2478F25af61` |
| IMAGE | `0xAcD98E323968647936887aD4934e64B01060727e` |
| AGII | `0x10052B8ccD2160b8F9880C6b4F5DD117fF253B1c` |
| BLDR | `0x798eD6bFc5bfCFc60938d5098825b354427A0786` |
| FGPT | `0x151ef362eA96853702Cc5e7728107e3961fbD22e` |
| MUSA | `0xDB829befCF8E582379E2c034FA2589b8D2EA1c5D` |

(No QTT on Makalu — it is Kamet-only.)

## What to send back

1. The deployed **bridge address** (the script prints it as `>>> 0x…`).
2. The generated `deployments/makalu-bridge-latest.json` (or just commit it).

## What infra does next (after the route is decided)

The **destination route is a separate client decision** (Makalu↔Kamet vs
Makalu→Sepolia/Base). Once both the bridge address and the route are known, infra:

1. Adds Makalu to `bridge-api/src/config.js`: real `bridge` for 700777 in
   `supportedChains`, a `chainsToWatch` entry (rpc `https://rpc.litho.ai`,
   `pollMs`), and the `TOKEN_PAIRS` rows for the chosen route.
2. Deploys the backend change to vps2 (`/opt/bridge`) and restarts the
   `bridge-api` container; confirms `/chains` shows the Makalu bridge.
3. Ships `@litho/multx-sdk` `MAKALU_TESTNET` preset (10 tokens + the bridge
   address + the route's destination chains), mirroring `KAMET_MAINNET`.

> Note: bridge-api `LITHO_RPC_HTTP` for Kamet points at a direct sentry
> (`http://31.97.39.146:8545`) to dodge the Cloudflare 2-level TLS gap; the
> Makalu watcher should likewise use a working Makalu RPC (`https://rpc.litho.ai`
> resolves to the mtest sentries today).

## Route decision (client, 2026-06-17): BOTH 1 & 2

Makalu bridges to **Kamet (900523)** AND **Sepolia (11155111) + Base Sepolia
(84532)**. The source-bridge deploy above is unchanged (serves all routes). The
SDK `MAKALU_TESTNET` preset's `destinationChains` = Kamet + Sepolia + Base.
Sequencing (Route 1 first — no external-chain blockers):

**Route 1 — Makalu ↔ Kamet (fast).** No new contracts. Once the Makalu bridge
address is back: add bidirectional `TOKEN_PAIRS` (the 10 shared tokens, Makalu
addr ↔ Kamet addr), add Makalu to `chainsToWatch`/`supportedChains`, restart
bridge-api. Lock/release is a liquidity model — **seed release-side reserves**:
the Kamet bridge must hold each token to release on Makalu→Kamet, and the
Makalu bridge likewise for Kamet→Makalu. Ship preset with Kamet as a dest.

**Route 2 — Makalu → Sepolia + Base (heavier, two blockers).**
- **Blocker A — funding.** The dest-side deployer has **0 ETH on Sepolia and
  Base Sepolia** (checked 2026-06-17). Fund via the CDP faucet
  (`packages/dnns-faucet`, 0.1 ETH/day/chain) or directly.
- **Blocker B — owner key.** The existing dest bridge
  `0xfdA3b83FE8438123eAF5153945A46F8fcF6175f4` (live on both Sepolia and Base)
  is owned by **`0x67317166F2cAc192fA3485856ffe4bB0b17A713C`** (the DNNS
  deployer, secret `litho/dnns/deployer-key`) — NOT the LEP100 deployer
  `0x10ed…4eadF`. `addSupportedToken` is `onlyOwner`, so Makalu wrapped-token
  registration must be signed by `0x6731…`, and that account is the one to fund.
- Plan (recommended **2a — reuse the existing dest bridge**, one per chain
  holding both Kamet- and Makalu-origin wrapped tokens). Alternative 2b
  (separate Makalu dest bridge per chain) avoids the owner-key dependency but
  makes the backend watch two dest bridges/chain.

### Route 2 — deploy commands (2a)

Status 2026-06-17: Blocker A cleared (`0x6731…` funded 0.1 ETH on each chain via
`packages/dnns-faucet`). Script ready: `scripts/deploy-makalu-dest-chain.js` —
deploys 10 `WrappedLEP100` (origin = Makalu token, `originChainId = 700777`,
`bridge = 0xfdA3b83F…`, symbols `m`-prefixed so they stay distinct from the
Kamet-origin `w`-prefixed wrapped tokens) and `addSupportedToken`s each. It
asserts `signer == dest-bridge owner`, so run with the **DNNS deployer key**
(`0x6731…`, secret `litho/dnns/deployer-key`) — NOT `0x10ed…`:

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=<0x6731 key>  npx hardhat run scripts/deploy-makalu-dest-chain.js --network sepolia
DEPLOYER_PRIVATE_KEY=<0x6731 key>  npx hardhat run scripts/deploy-makalu-dest-chain.js --network base_sepolia
```

Writes `deployments/{sepolia,base_sepolia}-makalu-bridge-latest.json` and prints
the `(makaluOrigin, wrappedAddr, symbol)` rows. **0.1 ETH/chain may not cover all
10 deploys + registrations on Sepolia (gas-heavy)** — if some fail, top up
(`node packages/dnns-faucet/fund.mjs`, 0.1/day cap) and re-run; the script
skips/reports failures so a re-run only does what's missing.

Then infra wires the backend (a `MAKALU_DEST_PAIRS` table → Makalu↔Sepolia and
Makalu↔Base `addPair`s, plus the wrapped tokens in `supportedChains`) and extends
the `MAKALU_TESTNET` preset's `destinationChains` to include Sepolia + Base.

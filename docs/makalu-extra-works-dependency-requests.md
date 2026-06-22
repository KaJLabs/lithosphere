# Makalu "Extra Works" — Dependency Requests

These are the concrete inputs needed from external teams to unblock streams 2–6 of the Makalu extra-works
backlog. Each block is written so it can be forwarded as-is. Full plan:
`~/.claude/plans/have-some-extra-works-warm-rossum.md`.

> Status snapshot (2026-06-21): Stream 1 (LEP100 faucet) is **done** — verified working in prod, fixed an
> FGPT/MUSA metadata swap. Stream 7 (toolchain) is unblocked and independent of all teams below.

---

## Stream 2 — MultX Swap (→ Backend / Bridge team)

The MultXBridge contract is deployed at `0x5832D5E609c6690f74c7683606Eb20F89ff096a6` on chain 700777, but
there is **no bridge/swap code in the Makalu monorepo**. To build the in-repo swap UI + API + indexing, we need:

1. **MultXBridge ABI** (JSON) — the deployed contract's ABI, plus its source if available.
2. **Counterpart-chain details** — the bridge contract address(es) on the other chain(s) and which chains
   are supported, plus the **token map** (which LEP-100 / ERC-20 tokens bridge to what on each side).
3. **Lock/release event signatures** — the exact events emitted on lock and on release/claim (names +
   indexed topics) so the indexer can ingest them into a `bridge_transfers` table.
4. **Claim/release flow spec** — since release is claim-based (no auto-executor), what exactly does a user
   submit to claim? The proof/attestation format (signature scheme, message structure, who signs), and the
   function signature they call.
5. **Where the existing bridge UI lives** — prior notes reference `BridgeRelease.jsx` and `relay-release.js`
   from the 2026-06-17 deploy. Which repo/path? We may port that logic rather than rewrite it.

With the above we can ship: SDK ABI export, `/api/bridge/*` (tokens, history, claimable), indexer ingestion,
and an explorer `bridge.tsx` + claim component.

---

## Stream 3 — Thanos Wallet (→ Wallet team)

The explorer already uses Web3Modal v5 + WalletConnect (`Makalu/explorer/context/WalletContext.tsx`). Wiring
Thanos in is small once we know **what kind of wallet it is**:

1. **If Thanos is a WalletConnect wallet:** its **WalletConnect Explorer (registry) ID** (the hex ID used in
   `featuredWalletIds`). Confirm it is listed in the WalletConnect registry.
2. **If Thanos is a browser extension / injected wallet:** its **EIP-6963 provider RDNS** (and whether it
   exposes a standard EIP-1193 provider), or a link to its SDK/integration docs.
3. Confirm Thanos supports **chain 700777** (EVM RPC `https://rpc.litho.ai`); if it needs a custom
   add-chain config, provide the expected parameters.

With (1) or (2) we can make Thanos the primary/featured wallet and smoke-test connect + a signed tx.

---

## Stream 4 — DNNS integration (→ DNNS team, dnns.litho.ai)

The explorer currently resolves only literal `0x…` and `litho1…` addresses. To add `*.litho`-style name
resolution we need the **resolution interface** — either:

- **On-chain resolver:** resolver **contract address + ABI** on 700777, with the methods for forward
  (`name → address`) and reverse (`address → name`) resolution, and the domain suffix convention; **or**
- **REST API:** base URL + endpoints for forward/reverse lookup, the response schema, auth (if any), and
  rate limits.

Also useful: a couple of **known registered names** for testing, and whether resolution should be cached
(TTL guidance). The public docs page renders client-side and didn't expose these — a short integration spec
or OpenAPI/ABI file is ideal.

---

## Stream 5 — Quantts integration (→ Quantt team, research.quantt.at / dev.quantt.at)

Greenfield; the public endpoint returns 403 so we have no contract to build against. We need:

1. **API base URL** (prod + dev) and **auth scheme** — API key? OAuth? Where do we get a key/credentials?
2. **Endpoints + response schemas** for the data we'd surface — confirm with the product owner *what* should
   appear in the explorer (e.g. token analytics, risk metrics, quant research, price feeds).
3. **Rate limits / caching guidance** (we'll proxy server-side via `/api/quant/*` and cache in Redis so the
   key never reaches the browser bundle).

With the API spec + a key we can build the server-side proxy and the explorer analytics widget(s).

---

## Stream 6 — Validator infra cleanup (→ Validator infra team)

This is ops work in the **Ansible/validator-infra repo, which is not in this monorepo**. To execute we need:

1. **Repo access** to the validator Ansible repo (and confirmation of which inventory is authoritative).
2. **A change window** for config pushes / sentry restarts.

Scope once unblocked (from prior findings):
- Clean `app.toml.j2` so an `ansible --tags config` dry-run shows **only** intended deltas — today it carries
  40+ pending drift changes (RPC `0.0.0.0` exposure, telemetry flips, economics) that make `--tags config`
  unsafe, forcing surgical `sed` edits and defeating intent-as-code.
- Align the 4 drifted sentries (AWS `10.0.1.218`, `10.1.1.227` + 2 Hostinger) from
  `timeout_commit=3s / timeout_propose=900ms` to match the active validators (`timeout_commit=500ms`).
- Add **automated drift detection** (scheduled diff of live `config.toml`/`app.toml` vs. Ansible intent),
  since drift has recurred (Kamet val-04 2026-05-05, mtest-val-01 2026-05-08).

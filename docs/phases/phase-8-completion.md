# Phase 8 — SDKs & Developer Experience Portal

> **Status:** **100%** (2026-05-12). Layered SDK + tag-gated npm publish with
> provenance + GraphQL schema artifact + OpenAPI REST artifact + OpenAPI → SDK
> type codegen + typed REST runtime client + runnable examples — all live,
> all drift-gated where applicable.
>
> First written at ~65% on 2026-05-11. See [§ Updates](#updates-since-first-writing-2026-05-11)
> below for what shipped after.

## Updates since first writing (2026-05-11)

Both items the original write-up listed as deferred ("OpenAPI / GraphQL
schema auto-generation") shipped, plus a typed runtime REST client and
runnable examples.

### GraphQL schema artifact + drift gate (2026-05-11)

`Makalu/api/scripts/print-schema.ts` re-prints `typeDefs` via
`graphql.print()`. Committed at `docs/api-reference/schema.graphql`
(210 lines, 18 types). CI's `schema-sync-check` job runs
`verify-schema-in-sync.ts` and fails on drift (cross-platform Node
diff, no shell redirects). A third-party integrator can fork the SDL
and codegen against it without running our server.

### OpenAPI REST artifact + drift gate (2026-05-12)

`Makalu/api/scripts/list-routes.ts` introspects both Express routers
(`explorerRouter` + `lithoRouter`) without starting a server (db pool
is lazy). `scripts/verify-openapi-in-sync.ts` compares the
`(METHOD, path)` set against `paths:` in `docs/api-reference/openapi.yaml`,
normalising Express `:param` ↔ OpenAPI `{param}` and stripping the
`/api` server prefix. CI job `openapi-sync-check` fails PRs that
add/rename/remove a route without updating the YAML. 24 endpoints
documented (21 explorer + 3 demo `/api/litho/*`).

Response-body shapes intentionally NOT gated — that surface is
test-owned. The route SET is the contract; the shapes are the
implementation.

Hand-parsed YAML for the `paths:` keys (same pattern as
`scripts/check-licenses.mjs`), no extra deps.

### OpenAPI → SDK type codegen + drift gate (2026-05-12)

`Makalu/packages/sdk/scripts/codegen-openapi.mjs` reads
`docs/api-reference/openapi.yaml` via `openapi-typescript@^7` (devDep,
no runtime cost) and emits a `paths` / `components` / `operations`
type tree at `src/generated/openapi.ts` (~1016 LoC). Re-exported from
`@lithosphere/sdk`. Drift-gated by a new `openapi-codegen-check` CI
job that re-runs the codegen and fails on `git diff --exit-code` —
symmetric with the producer-side `openapi-sync-check`. The route
contract is now drift-protected on both sides.

```ts
import type { paths } from '@lithosphere/sdk';
type BlocksResp = paths['/blocks']['get']['responses']['200']['content']['application/json'];
```

### Typed REST runtime client (2026-05-12)

`createLithoRestClient({ baseUrl })` returns a `Client<paths>` from
`openapi-fetch` typed against the generated paths interface. End-to-
end type safety: path strings autocomplete, query params validate,
response bodies type-narrow against the OpenAPI schema. Factory
pattern (not singleton) so tests + multi-network setups can have
independent clients. 4 tests cover URL composition, path-param
substitution, non-2xx surfaced as `{ error }` (not thrown), and
custom-header forwarding.

```ts
import { createLithoRestClient } from '@lithosphere/sdk';
const api = createLithoRestClient({ baseUrl: 'https://makalu.litho.ai/api' });
const { data, error } = await api.GET('/blocks', { params: { query: { limit: 10 } } });
```

### Runnable examples (2026-05-12)

`Makalu/packages/sdk/examples/`:

| Script | Exercises |
|--------|-----------|
| `01-balances.ts` | `LithoClient` against EVM JSON-RPC (chain head + native balance) |
| `02-rest-blocks.ts` | `createLithoRestClient` end-to-end with paginated `/blocks` + per-height detail |
| `03-contracts-viem.ts` | Pair `LEP100_ABI` from `@lithosphere/blockchain-core` with viem for a typed `readContract` |

Each script is self-contained, hits the live Makalu testnet, and
doubles as a smoke check that the chain + indexer are healthy.
`examples/README.md` covers both the monorepo-internal and standalone-
npm-install invocation paths.

### sdk-template scaffold refresh (2026-05-11)

`create-litho-app`'s SDK template no longer copies `client.ts` (484
LoC) + `types.ts` (275 LoC) verbatim. It now `pnpm add @lithosphere/sdk`
(pinned to `workspace:*` inside the monorepo; rewritten to `latest`
by the CLI at scaffold time) and demonstrates the extension pattern
via a `LithosphereExtensions` class. Bundle 1.87 KB (was an order of
magnitude bigger). 5 tests cover invalid-address rejection,
pending/success/failure paths, mixed batches.

### Bundle size

- SDK `dist/index.js`: 1.87 KB → **9.02 KB** (+7.15 KB) — the openapi-
  fetch runtime addition.
- SDK `dist/index.d.ts`: ~24 KB → **34.9 KB** (+11 KB) — the paths /
  components / operations type tree.

Both reasonable for what they buy.

The point-in-time content below describes the 2026-05-11 snapshot.

---

## What this phase covers

The phase goal from the work plan: **"Dev can call a contract on devnet in
under 10 minutes using the portal guide."** Coming into this phase that wasn't
possible — `@lithosphere/blockchain-core` was 100% empty stubs (`export {}` +
a `VERSION` constant), and the only working client code was buried inside the
`create-litho-app` template, not a published runtime package.

Leaving the phase: two layered npm packages, four runnable example apps in the
docs, and a release workflow that can publish to npm with provenance
attestations the moment an `NPM_TOKEN` secret is set.

## What we built

### Two layered packages

| Package | Role | Path | Tests |
|---------|------|------|------:|
| `@lithosphere/blockchain-core` | Low-level primitives — network registry, typed ABIs, `LithoError` + `ErrorCode`, shared types. Zero runtime deps, browser-safe. | `Makalu/packages/blockchain-core/` | 12 |
| `@lithosphere/sdk` | High-level client — `LithoClient` with retry/backoff, balance helpers, transaction polling. Re-exports `blockchain-core` so consumers install one package. | `Makalu/packages/sdk/` | 17 |

The split is deliberate: anyone building tooling for Lithosphere (e.g. a block
explorer, a wallet, an indexer) depends on **blockchain-core** for ABIs and
network constants without pulling in a runtime client. Application code
depends on **sdk** and gets everything in one install.

Both ship dual ESM + CJS (`tsup`) with `.d.ts` for ESM and CJS contexts, work
in Node 18+ and modern browsers, and use raw `fetch` — no transitive
viem/ethers/web3 dependency on the runtime path. For contract **writes** and
signing, pair the SDK with viem or ethers; the typed ABIs (`LEP100_ABI`,
`WLITHO_ABI`, `LITHONATIVE_ABI`) plug into both libraries directly.

### `LithoClient` — what it gives you

```ts
import { LithoClient, LithoError, ErrorCode } from '@lithosphere/sdk';

const client = new LithoClient('mainnet');
const { formatted, symbol } = await client.getBalance('0x22d...387');
console.log(`${formatted} ${symbol}`);
```

| Method | Returns | Notes |
|--------|---------|-------|
| `getChainId()` | `Promise<number>` | Avoids an RPC call when chainId is known from the registry. |
| `getBlockNumber()` | `Promise<number>` | Current head, decimal. |
| `getBalance(addr, opts?)` | `Promise<AccountBalance>` | Native LITHO, `formatted` + `balance` (bigint wei). |
| `getTransaction(hash)` | `Promise<TransactionResponse \| null>` | `null` for unknown hash. |
| `getTransactionReceipt(hash)` | `Promise<TransactionReceipt \| null>` | `null` while pending. |
| `waitForTransaction(hash, confirmations?, timeoutMs?, pollIntervalMs?)` | `Promise<TransactionReceipt>` | Throws `LithoError(TIMEOUT)` past budget. |
| `getNetworkConfig()` | `NetworkConfig \| null` | The registry entry matching the client's RPC URL. |

**Retry behaviour:** every RPC call goes through exponential backoff
(`delay * 2^attempt`, default `{count: 3, delay: 250}`), and retries only on
transient failures (`NETWORK_ERROR`, `RPC_TIMEOUT`, `RATE_LIMITED`). Bad params,
invalid addresses, and contract reverts fail immediately — retrying won't help.

**Errors:** every failure path throws `LithoError` with a typed `code`.
`instanceof LithoError` + `switch (err.code)` is the supported pattern. The
underlying cause is preserved on `err.cause` (ES2022 `Error.cause`).

### `NETWORKS` registry

```ts
import { NETWORKS } from '@lithosphere/sdk';

NETWORKS.mainnet;
// { name: 'mainnet', chainId: 700777, rpcUrl: 'https://rpc.litho.ai',
//   cosmosChainId: 'lithosphere_700777-2', bech32Prefix: 'litho',
//   currency: { name: 'Lithosphere', symbol: 'LITHO', decimals: 18, denom: 'ulitho' }, ... }
```

Four profiles ship: `mainnet`, `staging`, `devnet`, `local`. Today the first
three all resolve to the live Makalu testnet (there's no separate mainnet chain
yet — see [`docs/network/chain-parameters.md`](../network/chain-parameters.md)),
so choose the profile based on **intent** of the code path (production vs CI
staging vs local hardhat fork). `local` targets `http://localhost:8545`.

### Documentation portal updates

| Doc | Status |
|-----|--------|
| [`docs/api-reference/sdk-reference.md`](../api-reference/sdk-reference.md) | Rewrote from "Work in Progress" to a full reference: install, three runnable quickstarts, complete method table, errors enum, ABI exports, scaffolding pointer, versioning policy. |
| [`docs/developers/examples/wagmi-example.md`](../developers/examples/wagmi-example.md) | New. Next.js 14 + wagmi + viem setup using `NETWORKS` to derive the wagmi chain config, with a connect button, balance display, and LEP-100 `transfer` call wired through `useWriteContract`. |
| [`docs/developers/examples/ethers-example.md`](../developers/examples/ethers-example.md) | New. Node + ethers v6 reading native + token balances, signing a native transfer, and using `LithoClient.waitForTransaction` for confirmation polling. |
| [`docs/governance/release-process.md`](../governance/release-process.md) | New. `NPM_TOKEN` setup, semver policy for the SDK, dry-run procedure, rollback. |
| [`_sidebar.md`](../../_sidebar.md) | Surfaces the new examples + release process. |

The wagmi and ethers samples are deliberately end-to-end runnable — copy file,
`pnpm install`, set env, run. That's the "<10 min to call a contract" promise
from the phase spec.

### Tag-gated npm publish workflow

`.github/workflows/release.yaml` now syncs both packages' `package.json`
versions from the tag, builds + tests both, packs tarballs for the GitHub
Release, **and** publishes both to npm with `--provenance` attestations:

```yaml
publish_npm:
  needs: [validate, publish_github_release]
  if: startsWith(github.ref, 'refs/tags/v')
  permissions:
    contents: read
    id-token: write   # for provenance
  # ... publishes blockchain-core first, then sdk
```

The job is **`NPM_TOKEN`-aware**: if the secret isn't set, it emits a non-fatal
warning and skips publish — so the first release won't fail just because the
secret hasn't been added yet. The GitHub Release tarball publication still
goes through. Provenance attestations show up as a "verified" badge on the npm
package page linking back to the Actions run.

### `@lithosphere/sdk-template` rename

`Makalu/templates/sdk-template/` was previously also named `@lithosphere/sdk`,
which collided with the new package. Renamed to `@lithosphere/sdk-template`
(`private: true`). It remains the source-of-truth for the
`create-litho-app` scaffold — not published to npm, copied at scaffold time.

## How to use what was built

**Install (once published):**

```bash
pnpm add @lithosphere/sdk
# pulls @lithosphere/blockchain-core transitively
```

**Quickstart — read the head block:**

```ts
import { LithoClient } from '@lithosphere/sdk';
const client = new LithoClient('mainnet');
console.log(await client.getBlockNumber());
```

**Quickstart — read a LEP-100 balance via viem:**

```ts
import { LEP100_ABI, NETWORKS } from '@lithosphere/sdk';
import { createPublicClient, http } from 'viem';

const viemClient = createPublicClient({ transport: http(NETWORKS.mainnet.rpcUrl) });
const balance = await viemClient.readContract({
  address: '0xtoken...',
  abi: LEP100_ABI,
  functionName: 'balanceOf',
  args: ['0xholder...'],
});
```

**Cutting a release:**

```bash
git tag -a v0.1.0 -m "chore(release): v0.1.0"
git push origin v0.1.0
# CI builds, packs tarballs to the GitHub Release, and publishes to npm with provenance
```

Full walkthrough in [release-process.md](../governance/release-process.md).

## Why it matters

- **Closes the "<10 min to call a contract" acceptance criterion.** Before this
  phase the only path was "clone the monorepo, find the template, copy
  client.ts out of it." Now: `pnpm add @lithosphere/sdk`, copy a 5-line
  snippet from sdk-reference.md, done.
- **Decouples downstream from the live chain endpoints.** Anyone who hard-codes
  `rpc.litho.ai` in their code ships breakage on the next endpoint move. The
  `NETWORKS` registry is the one place to update.
- **Typed errors are recoverable errors.** A wallet UI can distinguish "RPC is
  slow, show a spinner" (`RPC_TIMEOUT`) from "user typed a bad address"
  (`INVALID_ADDRESS`) from "back off, you're being rate-limited"
  (`RATE_LIMITED`). Generic `Error` doesn't carry that information.
- **Browser-safe by construction.** `blockchain-core` has zero runtime deps,
  `sdk` only uses `fetch`. Bundling either into a frontend is one tree-shake
  away from the smallest possible footprint — no Node polyfills, no
  Buffer-shim drama.
- **Provenance attestations.** The published packages carry a cryptographically
  verifiable link back to the Actions run that built them. Supply-chain
  hardening at zero ongoing cost.

## Files & commits

| Path | What |
|------|------|
| `Makalu/packages/blockchain-core/` | Rebuilt from stubs: `src/networks.ts`, `src/errors.ts`, `src/types.ts`, `src/abis/{LEP100,WLITHO,LITHONative}.json`, `src/index.ts`, `tsup.config.ts`, `__tests__/networks.test.ts`. |
| `Makalu/packages/sdk/` | New package: `src/client.ts`, `src/index.ts`, `__tests__/client.test.ts`, `tsup.config.ts`, `README.md`, `CHANGELOG.md`. |
| `Makalu/templates/sdk-template/package.json` | Renamed to `@lithosphere/sdk-template`, `private: true`. |
| `.github/workflows/release.yaml` | Added `publish_npm` job, updated smoke test to assert canonical SDK exports. |
| `docs/api-reference/sdk-reference.md` | Rewritten from placeholder. |
| `docs/developers/examples/wagmi-example.md` | New. |
| `docs/developers/examples/ethers-example.md` | New. |
| `docs/governance/release-process.md` | New. |
| `_sidebar.md` | Added new example + release-process entries. |

Commit: `4701d55` (the entire layered SDK + docs + publish wiring landed
together).

## Deferred work

- **OpenAPI / GraphQL schema auto-generation.** The api service exposes both
  REST and GraphQL today but the schemas aren't auto-published. Tracked
  separately — it's a Phase 9-ish observability concern more than an SDK one.
- **`create-litho-app` template refresh.** The template still pre-dates the
  published SDK; updating its scaffold to `pnpm add @lithosphere/sdk` instead
  of copying `client.ts` is a small follow-up.
- **Cosmos LCD / REST helpers.** v0.1 of the SDK is EVM-only. Cosmos-side
  helpers (delegations, governance, validators) are a Cosmos-aware add-on
  package, not a v0.1 deliverable.
- **First actual npm release.** The workflow is ready; `NPM_TOKEN` needs to
  land in repo secrets and someone needs to push the first `v0.1.0` tag.

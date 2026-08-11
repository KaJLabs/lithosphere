# Kamet Explorer Implementation Status Reference

Updated: 2026-04-20

## Scope

This document tracks **only the lean v1 Kamet Explorer baseline** (sections 1–17). It is a code-level status reference, not a final live-production sign-off — `Done` means the code is in this repo, not that it has been validated against the live environment.

**Out of scope / tracked elsewhere:**

- MultX bridge UI (`src/pages/Swap/`) and bridge backend — see [`MULTX_DEPLOYMENT_GUIDE.md`](MULTX_DEPLOYMENT_GUIDE.md).
- `src/pages/Watchlist/` and `src/pages/TokenExplorer/` (market-data surfaces) are distinct from the explorer token catalog covered in section 7 and are not status-tracked here.
- dRPC / Nodehaus fallback RPC configuration in [`src/config/api.js`](src/config/api.js) — operational concern, not part of this baseline.
- Multichain UI scale work (commit `f390486`).

The absence of a Swap/Bridge/Watchlist section below is deliberate, not an omission.

## Legend

- Done: implemented in the current app.
- Partial: implemented, but with known gaps, fallback behavior, or missing backend/ops support.
- Remaining: not implemented or not yet captured as a documented/verified workflow.

## Verification Snapshot

- `npm run lint`: passed
- `npm run test:unit`: passed
- `npm run build`: passed
- `npm run test:e2e`: passed
- `npm run test:ci`: passed
- `npm run audit:assets`: passed
- `npm run test:live`: **8 passed / 0 failed** on 2026-04-20 against `https://kamet.litho.ai` after rolling out the current repo bundle (`index-D2cMi9eL.js`). Covers primary route smoke, faucet claim probe, MultX bridge + LITHO token deployment verification, live EVM transaction detail render, wallet-connect + Kamet network add + swap readiness flow, canonical search routing for block/tx, and narrow-screen route usability. The injected Playwright wallet now persists permission, chain, and known-chain state across page navigations in `localStorage` to mirror extension-wallet behavior.
- Local Docker verification of the shipped Nginx config passed on 2026-04-20:
  - `HEALTH:200:healthy`
  - `REDIRECT:HTTP/1.1 308 Permanent Redirect:Location: https://kamet.litho.ai/`
  - `RATE_LIMIT:429=115;200=45;total=160`
- The current Vite 7.3.2 / `@vitejs/plugin-react` 5.2.0 / `vite-plugin-svgr` 5.2.0 toolchain no longer emits the Sass `legacy-js-api` deprecation warning during builds.
- Mocked e2e now asserts no unexpected client `console.error`, `pageerror`, or unapproved 404 responses across the covered explorer flows, includes desktop and tablet axe smoke passes for serious and critical accessibility issues on representative explorer routes, verifies the block-feed virtualization wrapper on the canonical blocks route, enforces sticky-header plus no-horizontal-page-scroll regression checks on representative tablet and narrow-screen explorer routes, checks richer network-status incident rendering, component-health cards, scheduled-maintenance windows, status-coverage summary panels, and incident-history panels from the public metrics payload, and covers trace-derived internal transactions plus on-chain holder fallback on the address and token routes. The harness no longer needs WalletConnect-specific console-error exceptions because the active wallet path no longer ships that runtime.

## Summary Table

| Area | Status | Notes |
| --- | --- | --- |
| 1. Foundation and routing | Done | Canonical routes, deep links, header search, legacy hash redirect support |
| 2. Homepage essentials | Done | Stats, CTAs, latest blocks/txs, top validators, freshness, TPS |
| 3. Search quality | Done | Typed search recognition, smart routing, empty and delayed states |
| 4. Blocks page | Done | List and detail pages meet the requested baseline |
| 5. Transactions page | Done | List and detail pages meet the requested baseline |
| 6. Address and wallet pages | Done | Contract auto-mode, trace/indexed internal transactions, and derived NFT/asset inventory are implemented for surfaced contracts |
| 7. Token and asset pages | Done | Token pages derive current holders and transfer counts from on-chain history when indexed ownership endpoints are absent |
| 8. Validator and network pages | Partial | Validator and network pages exist, with validator-tooling links, ecosystem resources, component-health panels, scheduled-maintenance windows, status-summary coverage, postmortem and timeline support, and richer public incident/history rendering when the feed provides it, but history depth is still limited by the status monitor |
| 9. Contract UX | Done | Verified status, ABI, read/write, events, creator, deployment tx, wallet gating |
| 10. Real-time data and indexing | Done | Freshness pill, websocket-to-poll fallback, delayed-state support, monitored TPS |
| 11. UI polish | Partial | Responsive/sticky/skeleton/copy UX are in place, with keyboard-activatable rows, a skip link, labelled search, semantic tab panels, visible focus states, desktop/tablet accessibility smoke coverage, tablet/narrow-screen regression checks, and a dedicated manual QA matrix doc, but no full human accessibility/device pass is complete |
| 12. Error handling | Partial | Classified error states, structured malformed-input and rate-limit detection, reachability-aware network handling, retries, and deploy-time Sentry config validation exist, but final precision still depends on upstream API signals and deployment env values |
| 13. Performance | Done | Route-level lazy loading, explorer table virtualization, caching, chunk splitting, a lean injected-wallet bridge, system-font shell typography, trimmed legacy icons, and an upgraded Vite/Sass toolchain are in place |
| 14. SEO and trust signals | Done | Titles, metadata, favicon, footer trust links |
| 15. Security and production hardening | Done | Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, CSP, Permissions-Policy, COOP, CORP, Origin-Agent-Cluster, XPCDP), request-method restrictions, hidden-file deny, sanitization, HTTPS redirect, and request-rate limiting are all verified live at `https://kamet.litho.ai` as of 2026-04-20 |
| 16. Release-readiness checklist | Partial | `test:ci`, mocked explorer checks, mocked accessibility smoke coverage, live sign-off specs, and release docs are in place, but live-data sign-off, analytics, logging, alerting, and deployment alignment are not fully closed |
| 17. Fast triage if the frontend is broken | Done | Ordered triage runbook is now documented in-repo |

## Open Items and Ambiguities

The current frontend implementation is stable for the lean explorer baseline, but these items are still open or depend on external systems. They split cleanly into two buckets: items that still need engineering work in this repo, and items that are code-complete and only waiting on deployment or external services.

### Engineering still open

- **Manual accessibility and device QA pass.** The repo ships [`EXPLORER_ACCESSIBILITY_DEVICE_QA.md`](EXPLORER_ACCESSIBILITY_DEVICE_QA.md), plus automated axe coverage that now sweeps every canonical explorer route (home, blocks, block detail, transactions, tx detail, addresses, address detail, tokens, token detail, validators, validator detail, contracts, contract detail, search, network) on desktop and tablet, and tablet/narrow-screen responsive regressions. What is still missing is the human pass for contrast, focus order, keyboard behavior, screen-reader review, and real-device touch ergonomics.
- **Incident/network history depth.** Validator and network pages consume component-health, scheduled-maintenance, status-summary, incident-history, postmortem, and timeline fields when the public status feed exposes them, but total history depth and per-incident richness are capped by the upstream monitor payload shape — not by the frontend.

### Deployment-blocked only (code is ready)

- **Monitored client errors.** Sentry-compatible capture, DSN/release/host-allowlist validation, and noise suppression are wired in [`src/services/errorTracking.js`](src/services/errorTracking.js). Build pipeline now plumbs `VITE_SENTRY_DSN`, `VITE_SENTRY_ALLOWED_HOSTS`, `VITE_SENTRY_RELEASE`, `VITE_SENTRY_TRACES_SAMPLE_RATE`, `VITE_SENTRY_DEBUG`, and `VITE_APP_VERSION` through `Dockerfile`, `docker-compose.yml`, and [`ansible/playbooks/deploy-kamet-dashboard.yml`](../ansible/playbooks/deploy-kamet-dashboard.yml) (`SENTRY_DSN`/`SENTRY_ALLOWED_HOSTS`/etc. in the deployed `.env`). Sentry activates the moment a real DSN is supplied; empty DSN keeps it disabled by design.
- **Nginx hardening rollout.** Closed. The edge sentry proxy plus the container-level nginx now deliver the 308/301 HTTPS redirect, request-rate limiting, method restriction (DELETE/PUT/etc. → 403), dotfile deny (/.env → 403), and the full security-header set (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, CSP, Permissions-Policy, COOP, CORP, Origin-Agent-Cluster, XPCDP) on every location. A shared [`nginx-snippets/security-headers.conf`](nginx-snippets/security-headers.conf) is now `include`d in each location block so nginx's add_header inheritance rule stops swallowing them, verified live against `https://kamet.litho.ai` on 2026-04-20.
- **Live sign-off suite.** `npm run test:live` is 8/8 against `https://kamet.litho.ai` as of 2026-04-20 (primary route smoke, faucet claim probe, MultX bridge + LITHO token deployment, live EVM tx detail render, wallet-connect + Kamet network add + swap readiness, canonical block/tx search routing, narrow-screen route usability). Closed.
- **Production wallet-chain sign-off.** Injected-wallet path verified end-to-end against chain `900523` (Kamet) in the live suite. Closed.
- **Analytics, logging, and alerting.** Not wired by default; needs deployment-time env and downstream collector configuration.
- **Catalog breadth.** Address and token surfaces no longer require dedicated indexed holder or NFT-ownership endpoints for contracts they surface, but live catalog breadth still tracks the combined deployment registry plus explorer token sources exposed in the target environment.
- **Runbook exercise against live.** Closed on 2026-04-20. [`EXPLORER_TRIAGE_RUNBOOK.md`](EXPLORER_TRIAGE_RUNBOOK.md) walked end-to-end against `https://kamet.litho.ai`: domain + `/health` + deep-link SPA fallback all 200; EVM RPC `eth_chainId` = `0xdbdab` (900523), `eth_blockNumber` ≈ tip `0x5b6e7` (374503); cosmos `/blocks/latest` tip 374523 on `lithosphere_900523-2` (indexer fresh within ~20 blocks of chain tip); canonical deep links `/block/:h`, `/tx/:hash`, `/address/:addr`, `/tokens`, `/validators`, `/contracts`, `/search`, `/network` all return 200 SPA shell; full security-header set verified on the root response. [`EXPLORER_RELEASE_CHECKLIST.md`](EXPLORER_RELEASE_CHECKLIST.md) remains as the recurring per-release gate.

Ambiguities to keep in mind when reading this document:

- `Done` means implemented in the repo, not fully signed off in a live deployment.
- `Partial` usually means one of two things:
  - the frontend fallback UX is implemented, but indexed data is incomplete
  - the frontend code path is ready, but production env or backend support is still required
- "Monitored errors" currently means the instrumentation path exists in the codebase. It does not mean Sentry or an equivalent service is already enabled in production.
- "Status page surfaced" means the public status feed or link is shown in the UI. It does not guarantee deep incident history if the status monitor only emits summary payloads.
- "Minimum acceptable v1" is implemented from a frontend feature perspective, but still not equivalent to full production launch approval.

## 1. Foundation and Routing

Status: Done

Completed:

- Stable routes exist for home, blocks, transactions, addresses, tokens, validators, contracts, search results, network, faucet/settings, swap, and not found.
- Canonical deep links work for:
  - `/block/:heightOrHash`
  - `/tx/:hash`
  - `/address/:address`
  - `/token/:contract`
  - `/validator/:operator`
- The global search bar is available in the shared header on major pages.
- Legacy `/#/...` routes are normalized into clean browser routes on load.
- SPA fallback is configured so direct-pasted routes resolve.

Primary files:

- [`src/routes/routeConfig.jsx`](src/routes/routeConfig.jsx)
- [`src/Main.jsx`](src/Main.jsx)
- [`src/components/Header.jsx`](src/components/Header.jsx)
- [`nginx.conf`](nginx.conf)

Remaining:

- None for the requested lean v1 routing baseline.

## 2. Homepage Essentials

Status: Done

Completed:

- Above-the-fold stats exist for latest block, average block time, gas price, total transactions, validator count, and wallet/address count.
- TPS is surfaced from the monitored status feed.
- CTA buttons exist for view latest blocks, view latest transactions, add network, and connect wallet.
- Real-time latest blocks and latest transactions sections exist.
- Top validators are surfaced on the homepage.
- Freshness and delayed-state messaging are shown instead of placeholder zeroes.

Primary files:

- [`src/pages/SearchEngine/SearchEngine.jsx`](src/pages/SearchEngine/SearchEngine.jsx)
- [`src/services/explorerDataService.js`](src/services/explorerDataService.js)

Remaining:

- None for the requested homepage baseline.

## 3. Search Quality

Status: Done

Completed:

- Search recognizes tx hashes, block numbers, block hashes, wallet addresses, contract addresses, validator operator addresses, token symbols, and token contracts.
- Instant input hints are shown while typing.
- Smart routing is implemented:
  - numeric input routes to block lookup first
  - `0x` addresses route to address, token, or contract
  - full tx hashes route to transaction detail
- Search results page includes empty, invalid, and delayed/indexing states.

Primary files:

- [`src/components/explorer/GlobalSearchForm.jsx`](src/components/explorer/GlobalSearchForm.jsx)
- [`src/pages/SearchResults/SearchResults.jsx`](src/pages/SearchResults/SearchResults.jsx)
- [`src/helpers/explorer.js`](src/helpers/explorer.js)
- [`src/services/explorerDataService.js`](src/services/explorerDataService.js)

Remaining:

- None for the requested search baseline.

## 4. Blocks Page

Status: Done

Completed:

- Blocks table includes block height, timestamp, tx count, proposer, gas used, finality/status, and size.
- Pagination exists.
- Sorting exists.
- Relative and exact timestamps are shown.
- Click-through exists to proposer and included transactions.
- Block detail page exposes hash, parent hash, timestamp, proposer, gas used, gas limit, size, and included tx list.

Primary files:

- [`src/pages/BlockExplorer/BlockExplorer.jsx`](src/pages/BlockExplorer/BlockExplorer.jsx)
- [`src/pages/BlockExplorer/BlockDetail.jsx`](src/pages/BlockExplorer/BlockDetail.jsx)

Remaining:

- None for the requested block explorer baseline.

## 5. Transactions Page

Status: Done

Completed:

- Transactions list includes hash, method/type, from, to, amount, fee, status, and age.
- Transaction detail page exposes status, block number, confirmations/finality, sender/recipient, gas price, gas used, logs/events, raw input, and decoded input when ABI is known.
- Copy buttons exist for hashes and addresses through shared explorer UI.

Primary files:

- [`src/pages/TransactionSearch/TransactionSearch.jsx`](src/pages/TransactionSearch/TransactionSearch.jsx)
- [`src/pages/TransactionSearch/TransactionDetail.jsx`](src/pages/TransactionSearch/TransactionDetail.jsx)
- [`src/components/explorer/ExplorerUI.jsx`](src/components/explorer/ExplorerUI.jsx)

Remaining:

- None for the requested transaction baseline.

## 6. Address and Wallet Pages

Status: Done

Completed:

- Address page shows current balance, token balances, transaction history, and contract interactions.
- Tabs exist for transactions, token transfers, NFTs / LEP100 assets, contract, and analytics.
- Contract auto-detection switches the page into contract mode automatically.
- Contract tab links into the dedicated contract page.
- Asset cards now surface known token type and verification status for LEP100 balances.
- Assets tab now includes explicit coverage summaries for known assets, verified assets, LEP100 balances, and NFT inventory status.
- Assets and contract tabs now explain unsupported public-data surfaces instead of implying full NFT or internal-transfer coverage.
- Contract tab now surfaces recent contract interaction transactions directly, even when the page is in wallet mode.
- Analytics tab now includes contract interaction count and unique counterparties in addition to inbound and outbound flow summaries.
- Transactions tab now includes a dedicated internal-transactions surface that automatically renders indexed traces when the explorer data API exposes them.
- Token transfer activity now uses public LEP100 transfer logs so asset coverage is not limited to current balances.
- Assets tab now merges current known balances with observed token-transfer activity, producing a broader address asset view even when current token balances are zero.
- Address data service now includes indexed-address adapters for internal transaction traces and NFT inventory so those surfaces render automatically when the explorer data API supports them.
- Analytics now includes token-transfer count, observed-asset count, internal-transaction count, and NFT inventory count/status.
- Address pages now fall back to trace-derived internal transactions from public EVM `trace_filter` support when indexed address-profile traces are unavailable.
- Address asset inventory now derives current holdings from full on-chain transfer history for surfaced token contracts, so NFT inventory and legacy LEP100 activity no longer depend solely on indexed ownership payloads.
- Asset coverage now uses the combined surfaced token catalog rather than only the static known-token list, so non-registry contracts from the explorer token API can participate in balance, ownership, and transfer views.

Primary files:

- [`src/pages/AddressSearch/AddressSearch.jsx`](src/pages/AddressSearch/AddressSearch.jsx)
- [`src/pages/AddressDetails/AddressPage.jsx`](src/pages/AddressDetails/AddressPage.jsx)
- [`src/services/explorerDataService.js`](src/services/explorerDataService.js)

Remaining:

- None for the requested address and wallet baseline in the repo.

## 7. Token and Asset Pages

Status: Done

Completed:

- Token metadata, total supply, transfers, contract address, and verification status are exposed.
- Token catalog page exists.
- Filters exist for all, fungible, LEP100 / native, and NFT.
- Verified contract discoverability is supported through the contracts view and token-to-contract linking.
- Token detail now surfaces observed holder activity from the recent public transfer window when exact holder indexing is unavailable.
- Token catalog now surfaces coverage summary cards for visible assets, verified assets, LEP100 / native assets, and NFT inventory status.
- NFT filtering now uses an explicit indexed-data message instead of a silent empty catalog state.
- Token detail now exposes creator, deployment timestamp, and source path metadata when the token is known in the deployment registry.
- Token detail now explicitly distinguishes observed-holder coverage from exact indexed holder counts.
- Token catalog now merges known deployment-registry tokens with optional indexed token records from the explorer data API when available.
- Token catalog now surfaces observed holder and transfer counts from recent public token activity instead of leaving those columns empty by default.
- Token detail now supports indexed exact-holder tables automatically when the explorer data API exposes `/tokens/:contract/holders`, while keeping observed holders as the fallback activity view.
- NFT token filtering can now surface live entries when the indexed token catalog exposes NFT-typed assets, instead of being hardcoded to an always-empty list.
- Token detail now derives exact current holders from full on-chain transfer history when indexed holder rows are unavailable, instead of stopping at observed recent transfer participants.
- Token catalog holder and transfer counts now use cached ownership snapshots from surfaced token contracts, so holder coverage no longer depends on `/tokens/:contract/holders` for standard contracts in the catalog.
- Native token detail now derives holder count from the explorer summary wallet count instead of forcing the route through the heavier token catalog path.
- NFT token browsing now follows the combined catalog plus on-chain ownership replay for surfaced NFT contracts, rather than treating all NFT coverage as indexer-only.

Primary files:

- [`src/pages/Tokens/Tokens.jsx`](src/pages/Tokens/Tokens.jsx)
- [`src/pages/Tokens/TokenDetail.jsx`](src/pages/Tokens/TokenDetail.jsx)
- [`src/pages/Contracts/Contracts.jsx`](src/pages/Contracts/Contracts.jsx)

Remaining:

- None for the requested token and asset baseline in the repo.

## 8. Validator and Network Pages

Status: Partial

Completed:

- Validator pages show name, voting power, commission, uptime, jailed/active status, and recent proposed blocks.
- Network overview page exists and surfaces chain health, recent incidents, latency, indexing lag, and API status.
- Public status state is surfaced in the header and footer.
- Validator list and detail views now expose first-class tooling links for the validator portal, staking record, commission endpoint, and public status page.
- Network overview now consumes the public status metrics feed for active incidents and recent status events.
- Validator detail now exposes richer ecosystem and operator resources, including governance, setup guide, docs, latest validator set, and slashing-signing endpoints when available.
- Network overview now exposes a dedicated resource panel for docs, setup guide, validator portal, governance, ecosystem, and faucet links.
- Network incident panels now explicitly explain when public status events are summary-only because the monitor payload is shallow.
- Network incident and recent-event cards now render richer public-status fields when present, including title, details, component/source tags, affected targets, lifecycle timestamps, and direct public incident links.
- Network overview now surfaces component-level public status records when the feed exposes them, and falls back to derived status, REST, and indexer health cards when the feed is sparse.
- Network overview now surfaces historical incident records from the public metrics feed when they are available, instead of limiting the page to active alerts and recent events only.
- Network overview now surfaces scheduled maintenance windows when the public metrics feed publishes them, including planned start/end, duration, affected targets, and public maintenance links.
- Network overview now surfaces status-summary counts and published availability metrics from the monitor payload, with derived fallbacks when explicit summary fields are absent.
- Network incident, event, and maintenance panels now render richer optional monitor fields when present, including impact, root cause, resolution, tags, postmortem links, and nested timeline updates with authored and status-tagged entries.

Primary files:

- [`src/pages/ValidatorList/ValidatorList.jsx`](src/pages/ValidatorList/ValidatorList.jsx)
- [`src/pages/ValidatorList/ValidatorDetail.jsx`](src/pages/ValidatorList/ValidatorDetail.jsx)
- [`src/pages/AdditionalInfo/AdditionalInfo.jsx`](src/pages/AdditionalInfo/AdditionalInfo.jsx)
- [`src/components/Layout/Layout.jsx`](src/components/Layout/Layout.jsx)
- [`src/components/Header.jsx`](src/components/Header.jsx)
- [`src/services/explorerDataService.js`](src/services/explorerDataService.js)
- [`src/config/api.js`](src/config/api.js)

Remaining:

- Incident detail quality and total history depth still depend on the public status monitor payload and may remain shallow when the status service reports only summary events or omits historical incident fields.

## 9. Contract UX

Status: Done

Completed:

- Contract detail page includes verified source indicator, ABI, read functions, write functions, recent events, creator, and deployment tx.
- Write interaction UI is gated behind wallet connection and the correct Kamet network.
- Large ABI/source payloads stay collapsed by default.

Primary files:

- [`src/pages/Contracts/ContractDetail.jsx`](src/pages/Contracts/ContractDetail.jsx)
- [`src/services/explorerDataService.js`](src/services/explorerDataService.js)

Remaining:

- None for the requested contract UX baseline.

## 10. Real-Time Data and Indexing

Status: Done

Completed:

- Freshness is shown as indexed-through block plus last-updated time.
- Websocket failure degrades to polling.
- Indexing lag and delayed data are surfaced to the user.
- Headline metrics avoid fake zero placeholders and instead show delayed/indexing states.
- TPS is now surfaced from the monitored public status feed rather than a placeholder calculation.

Primary files:

- [`src/hooks/useRealtimeRefresh.js`](src/hooks/useRealtimeRefresh.js)
- [`src/components/explorer/ExplorerUI.jsx`](src/components/explorer/ExplorerUI.jsx)
- [`src/pages/SearchEngine/SearchEngine.jsx`](src/pages/SearchEngine/SearchEngine.jsx)
- [`src/pages/AdditionalInfo/AdditionalInfo.jsx`](src/pages/AdditionalInfo/AdditionalInfo.jsx)

Remaining:

- None for the requested real-time/indexing baseline.

## 11. UI Polish

Status: Partial

Completed:

- Responsive explorer layout exists for desktop and mobile.
- Header is sticky.
- Hashes and addresses are shortened with full-value tooltip and copy support.
- Skeleton loaders exist across major pages.
- Tables, cards, and panels now share a more consistent explorer visual system.
- Major explorer table rows now support keyboard activation through shared row interaction helpers.
- Focus-visible styling is applied to primary explorer actions, tabs, copy controls, links, cards, and interactive table rows.
- Shared copy controls no longer wrap nested button interactions inside route links.
- A shared skip link now lands keyboard users on the main content region instead of requiring them to tab through the shell first.
- The shared global search input now has an explicit accessible label plus live hint and error messaging.
- Address activity tabs and token filter tabs now expose named tablists with labelled tab panels for the active content region.
- The sidebar theme toggle now exposes an accessible name and pressed state instead of shipping as an unlabeled icon-only button.
- Mocked browser coverage now includes a desktop and tablet axe pass that sweeps every canonical explorer route (home, blocks list and detail, transactions list and detail, addresses list and detail, tokens list and detail, validators list and detail, contracts list and detail, search, network) for serious and critical accessibility violations.
- Mocked browser coverage now includes tablet and narrow-screen responsive regression checks that lock sticky header behavior, shared header-search visibility, and the absence of horizontal page scrolling on representative explorer routes.
- A dedicated manual accessibility and real-device QA matrix is now documented in-repo for pre-release human sign-off.

Primary files:

- [`src/App.scss`](src/App.scss)
- [`src/components/Layout/Layout.jsx`](src/components/Layout/Layout.jsx)
- [`src/components/Sidebar.jsx`](src/components/Sidebar.jsx)
- [`src/scss/components/header.scss`](src/scss/components/header.scss)
- [`src/scss/pages/Explorer/explorerPage.scss`](src/scss/pages/Explorer/explorerPage.scss)
- [`src/components/explorer/ExplorerUI.jsx`](src/components/explorer/ExplorerUI.jsx)
- [`src/components/explorer/GlobalSearchForm.jsx`](src/components/explorer/GlobalSearchForm.jsx)
- [`src/helpers/explorerInteraction.js`](src/helpers/explorerInteraction.js)
- [`src/pages/AddressDetails/AddressPage.jsx`](src/pages/AddressDetails/AddressPage.jsx)
- [`src/pages/Tokens/Tokens.jsx`](src/pages/Tokens/Tokens.jsx)
- [`src/index.scss`](src/index.scss)
- [`tests/e2e/explorer.a11y.spec.js`](tests/e2e/explorer.a11y.spec.js)
- [`tests/e2e/explorer.responsive.spec.js`](tests/e2e/explorer.responsive.spec.js)
- [`playwright.config.js`](playwright.config.js)
- [`EXPLORER_ACCESSIBILITY_DEVICE_QA.md`](EXPLORER_ACCESSIBILITY_DEVICE_QA.md)

Remaining:

- No full manual accessibility audit has been completed for contrast, focus states, keyboard behavior, and touch ergonomics. The automated axe sweep now covers every canonical route on desktop and tablet, but exhaustive coverage does not replace a human pass.
- Real-device QA is still advisable before launch even though tablet and narrow-screen responsive regressions are now covered in CI.

## 12. Error Handling

Status: Partial

Completed:

- A shared classified error model exists for:
  - `invalid_input`
  - `not_found`
  - `timeout`
  - `indexer_unavailable`
  - `unsupported_object_type`
  - `generic`
- Route-param validation now happens before fetches on block, transaction, address, token, validator, and contract detail pages.
- Search explicitly differentiates malformed hash or address input from unsupported object types such as validator consensus addresses.
- Friendly invalid/not-found/degraded states exist on major explorer pages through shared explorer UI.
- Retry buttons are present on retryable error states and data panels.
- Axios no-response failures and browser reachability failures now classify as `indexer_unavailable` instead of falling through to the generic degraded state.
- Common edge timeout and availability statuses such as `522`, `524`, `520`, `521`, `523`, and `525` are now normalized into retryable timeout or unavailable explorer states.
- Malformed upstream `400` / `422` validation failures now classify as `invalid_input`, and public `429` responses now surface a clearer retryable rate-limit message.
- Native `fetch` / `AbortController` failures whose only signal is a DOM exception `name` (`AbortError`, `TimeoutError`, `NetworkError`) now classify into the right state (timeout or indexer unavailable) instead of falling through to the generic retryable bucket.
- Client-side error capture is wired through Sentry-compatible plumbing.
- Sentry config resolution now validates DSN and release inputs, supports host allowlists and traces sample-rate envs, and suppresses noisy browser-extension or third-party script errors before capture.
- An application-level error boundary exists.
- Unit coverage now locks the shared classifier behavior for 404s, malformed validation failures, edge timeouts, rate limits, no-response network failures, reachability failures, validator consensus unsupported-input paths, and DOM-exception-`name`-only failures (`AbortError`, `TimeoutError`, `NetworkError`).

Primary files:

- [`src/helpers/explorerErrors.js`](src/helpers/explorerErrors.js)
- [`src/test/helpers/explorerErrors.test.js`](src/test/helpers/explorerErrors.test.js)
- [`src/components/explorer/ExplorerUI.jsx`](src/components/explorer/ExplorerUI.jsx)
- [`src/pages/SearchResults/SearchResults.jsx`](src/pages/SearchResults/SearchResults.jsx)
- [`src/components/AppErrorBoundary.jsx`](src/components/AppErrorBoundary.jsx)
- [`src/services/errorTracking.js`](src/services/errorTracking.js)
- [`src/test/services/errorTracking.test.js`](src/test/services/errorTracking.test.js)
- [`.env.example`](.env.example)

Remaining:

- Final timeout vs unavailable precision still depends on upstream status codes and error payload quality.
- Unstructured upstream failures that carry no status code, no recognized `code`/`name`, and no recognizable message pattern can still fall back to the generic retryable state.
- Monitored errors are only active when `VITE_SENTRY_DSN` is configured in the deployment environment.

## 13. Performance

Status: Done

Completed:

- Major explorer routes are lazy-loaded at the route level.
- A shared suspense fallback renders explorer skeletons instead of a blank screen while lazy routes load.
- Recent blocks and transaction responses are cached in the frontend data layer.
- Vite manual chunk splitting is configured.
- Shared `ethers` and `@ethersproject/*` modules now emit as a dedicated `evm-utils` chunk instead of riding inside the broader vendor bucket.
- Shared and page-level Sass imports have been migrated from deprecated `@import` usage to the Sass module system.
- The build toolchain now runs on Vite 7.3.2 with `@vitejs/plugin-react` 5.2.0 and `vite-plugin-svgr` 5.2.0, and SVG component imports were migrated onto the supported `?react` path for older icon-heavy pages.
- The production build no longer emits the Sass `legacy-js-api` deprecation warning.
- The active wallet path now uses a lean injected EIP-1193 bridge instead of the previous AppKit / Web3Modal runtime, while preserving the same explorer-facing context API for connect, disconnect, signer access, and network switching.
- Manual wallet disconnect now stays suppressed for the browser session so the shell does not immediately auto-reconnect to an injected wallet after a user-triggered disconnect.
- The production build no longer emits `wallet-runtime` or `walletconnect` chunks after the wallet-runtime removal, so that entire runtime class is gone from the active chunk graph.
- Shared header, sidebar, swap network badge, native-token fallback icon, and favicon now use a compact SVG brand mark instead of the heavier runtime PNG asset.
- The production build now emits the shared brand shell asset as a ~2.4 kB SVG instead of the previous ~81 kB PNG on explorer surfaces.
- Heavy explorer list surfaces now render through a shared virtualized table wrapper with sticky headers and spacer-row windowing on the blocks, transactions, tokens, and validators pages.
- The current build emits `monitoring` (Chart.js / lightweight-charts / react-chartjs-2) at ~432.8 kB as the heaviest chunk, `evm-utils` at ~288.0 kB, `vendor` at ~284.7 kB, and the root `index` bundle at ~112.3 kB, with no post-upgrade circular-chunk warning.
- Public social/share branding now ships as a generated `logo.jpg` (~34.3 kB) instead of the old `logo.png`, and the fallback `favicon.ico` was reduced from ~81.3 kB to ~3.8 kB.
- The default Vite `public/vite.svg` file and dead explorer branding PNGs were removed from the repo so they no longer ship in the public tree or source bundle.
- Brand raster fallbacks are now reproducible through `npm run generate:brand-assets` instead of relying on checked-in opaque binary assets.
- The app now uses a shared system-font stack in the shell instead of shipping custom Metropolis webfonts, and the old font assets were removed from the active build path and source tree.
- A dedicated `npm run audit:assets` script now reports current public and source-asset sizes. In the current snapshot, public brand assets total ~40.4 kB and source icons total ~102.3 kB after trimming the previous `ethLight.svg` and `metamask.svg` hot spots.
- Large ABI and raw JSON payloads stay collapsed by default instead of rendering expanded.

Primary files:

- [`src/routes/routeConfig.jsx`](src/routes/routeConfig.jsx)
- [`src/components/explorer/RouteLoadingFallback.jsx`](src/components/explorer/RouteLoadingFallback.jsx)
- [`src/components/explorer/ExplorerUI.jsx`](src/components/explorer/ExplorerUI.jsx)
- [`src/context/DeferredWalletProvider.jsx`](src/context/DeferredWalletProvider.jsx)
- [`src/context/walletContextBase.js`](src/context/walletContextBase.js)
- [`src/services/explorerDataService.js`](src/services/explorerDataService.js)
- [`src/config/api.js`](src/config/api.js)
- [`vite.config.js`](vite.config.js)
- [`package.json`](package.json)
- [`package-lock.json`](package-lock.json)
- [`scripts/generateBrandAssets.mjs`](scripts/generateBrandAssets.mjs)
- [`scripts/auditAssets.mjs`](scripts/auditAssets.mjs)
- [`src/index.jsx`](src/index.jsx)
- [`src/index.scss`](src/index.scss)
- [`src/assets/icons/litho-mark.svg`](src/assets/icons/litho-mark.svg)
- [`src/assets/icons/logo.svg`](src/assets/icons/logo.svg)
- [`src/assets/icons/logoWhiteTheme.svg`](src/assets/icons/logoWhiteTheme.svg)
- [`src/assets/icons/ethLight.svg`](src/assets/icons/ethLight.svg)
- [`src/assets/icons/metamask.svg`](src/assets/icons/metamask.svg)
- [`public/logo.jpg`](public/logo.jpg)
- [`public/favicon.ico`](public/favicon.ico)
- [`public/favicon.svg`](public/favicon.svg)
- [`src/components/Header.jsx`](src/components/Header.jsx)
- [`src/pages/SearchEngine/SearchEngine.jsx`](src/pages/SearchEngine/SearchEngine.jsx)
- [`src/pages/BlockExplorer/BlockExplorer.jsx`](src/pages/BlockExplorer/BlockExplorer.jsx)
- [`src/pages/TransactionSearch/TransactionSearch.jsx`](src/pages/TransactionSearch/TransactionSearch.jsx)
- [`src/pages/Tokens/Tokens.jsx`](src/pages/Tokens/Tokens.jsx)
- [`src/pages/ValidatorList/ValidatorList.jsx`](src/pages/ValidatorList/ValidatorList.jsx)
- [`src/pages/Settings/Settings.jsx`](src/pages/Settings/Settings.jsx)
- [`src/pages/AdditionalInfo/AdditionalInfo.jsx`](src/pages/AdditionalInfo/AdditionalInfo.jsx)
- [`src/components/Sidebar.jsx`](src/components/Sidebar.jsx)
- [`src/pages/Swap/Swap.jsx`](src/pages/Swap/Swap.jsx)
- [`src/services/tokenService.js`](src/services/tokenService.js)
- [`index.html`](index.html)
- [`src/pages/Contracts/ContractDetail.jsx`](src/pages/Contracts/ContractDetail.jsx)
- [`src/pages/TransactionSearch/TransactionDetail.jsx`](src/pages/TransactionSearch/TransactionDetail.jsx)

Remaining:

- None for the requested section 13 baseline.
- Optional future work if bundle budgets tighten further:
  - trim additional legacy source icons such as `settings.svg` or `wethIcon.svg`
  - consider dropping `lightweight-charts` or `chart.js` to shrink the `monitoring` chunk (currently the heaviest at ~432.8 kB), if charting is not required for the v1 launch
  - further reduce the `vendor` or `evm-utils` chunks if those budgets become release gates

## 14. SEO and Trust Signals

Status: Done

Completed:

- Page titles are set per page and follow the expected explorer pattern.
- Metadata and favicon are present.
- Footer links include docs, status, RPC, faucet, and validator portal.
- Status is also exposed in header/footer UI for trust signaling.

Primary files:

- [`src/hooks/usePageMeta.js`](src/hooks/usePageMeta.js)
- [`index.html`](index.html)
- [`src/components/Layout/Layout.jsx`](src/components/Layout/Layout.jsx)

Remaining:

- None for the requested trust-signal baseline.

## 15. Security and Production Hardening

Status: Partial

Completed:

- CSP headers are configured.
- Security response headers are defined for frame/content sniffing, referrer handling, permissions policy, cross-origin isolation hints, and HSTS.
- CSP frame allowances were tightened after the wallet stack moved to an injected-wallet-only path, so legacy WalletConnect verification domains are no longer whitelisted.
- Hidden files and dotfiles are denied in the default Nginx config.
- Static SPA routes are limited to `GET`, `HEAD`, and `OPTIONS`.
- Search input is sanitized before routing and lookup.
- Contract ABI parsing is wrapped defensively to avoid crashing on malformed payloads.
- The frontend does not intentionally expose admin/indexer internals.
- A dedicated production hardening checklist now exists in the repo.
- The shipped Nginx config now performs repo-local HTTP-to-HTTPS redirects unless the request is explicitly local-development traffic.
- The shipped Nginx config now applies request-rate limiting to SPA document routes and static assets, with `429` responses on burst overflow.
- Local Docker verification confirmed the repo config returns `/health`, issues a `308` redirect for plain HTTP, and emits `429` under burst traffic.

Primary files:

- [`nginx.conf`](nginx.conf)
- [`Dockerfile`](Dockerfile)
- [`src/helpers/explorer.js`](src/helpers/explorer.js)
- [`src/services/explorerDataService.js`](src/services/explorerDataService.js)
- [`EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md`](EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md)

Remaining:

- The repo-local HTTPS redirect and request-rate limiting still need to be rolled out on the live Kamet deployment or replicated at the active ingress or CDN layer.
- Backend API rate limiting and broader WAF or bot mitigation still remain backend or edge responsibilities outside this repo.
- The hardening checklist still needs to be exercised against the live Kamet deployment before production sign-off.

## 16. Release-Readiness Checklist

Status: Partial

Completed:

- Search flows are implemented for known explorer object types.
- Latest block and latest transaction feeds auto-refresh.
- Empty states are styled.
- Footer links and status link are present.
- Wallet connect and add-network flows are implemented.
- Mobile coverage exists in e2e.
- Tablet coverage now exists in e2e alongside the existing mobile project.
- `npm run test:ci` now passes and covers lint, unit tests, mocked e2e, and production build generation.
- Mocked e2e now asserts no unexpected `console.error`, `pageerror`, or unapproved 404 responses across the covered explorer flows.
- Mocked e2e now includes a desktop axe smoke pass that fails on serious or critical accessibility violations across representative explorer routes.
- Mocked e2e now includes a tablet Chromium project plus a dedicated responsive regression spec that locks sticky-header behavior, shared header-search visibility, and the absence of horizontal page scrolling on representative tablet and narrow-screen routes.
- Unit coverage now explicitly verifies transaction page initial load, 12-second polling refresh, interval cleanup, and stale-data retention during background refresh.
- Unit coverage now explicitly verifies shared explorer error classification for not found, edge timeout, network reachability failure, and unsupported validator-consensus inputs.
- A canonical-route live Playwright suite now exists for the deployed Kamet environment, covering shared-shell expectations, canonical deep links, wallet and connect routes, network route rendering, and narrow-screen live navigation.
- Mocked e2e now covers:
  - homepage render
  - shared shell skip-link focus path to the main content region
  - shared header wallet button render
  - labelled global search input visibility
  - homepage TPS surface
  - canonical block and transaction deep links
  - shared virtualized block-feed wrapper on the canonical blocks route
  - keyboard activation on major explorer table rows
  - exhaustive axe coverage across all canonical explorer routes on desktop and tablet for serious and critical accessibility issues
  - tablet and narrow-screen responsive regression checks on representative routes
  - address, token, validator, contract, search, and network routes
  - named address activity tabs and token filter tab panels
  - address asset coverage messaging, trace-derived internal transactions, token-transfer activity, observed-asset cards, and no-contract-interaction states
  - token holder-coverage messaging, derived current-holder fallback, and creator metadata on known tokens
  - token catalog activity fallback and token-detail observed-holder activity on known tokens
  - validator tooling and ecosystem resource panel render
  - network active-incidents panel render
  - richer network incident title, details, component/source tags, affected targets, and public-link rendering from the mocked status metrics feed
  - network component-health cards from the mocked public status metrics feed
  - network scheduled-maintenance panel render from the mocked public status metrics feed
  - network status-coverage summary panel render from the mocked public status metrics feed
  - network incident-history panel render from the mocked public status metrics feed
  - network resource panel render and incident-detail caveat messaging
  - shared-header search for known block, tx, address, validator, and token inputs
  - friendly invalid-state coverage for malformed deep links and unsupported object types
- A dedicated release checklist now exists in the repo.

Primary files:

- [`package.json`](package.json)
- [`src/pages/TransactionSearch/TransactionSearch.test.jsx`](src/pages/TransactionSearch/TransactionSearch.test.jsx)
- [`tests/e2e/explorer.a11y.spec.js`](tests/e2e/explorer.a11y.spec.js)
- [`tests/e2e/explorer.e2e.spec.js`](tests/e2e/explorer.e2e.spec.js)
- [`tests/e2e/explorer.responsive.spec.js`](tests/e2e/explorer.responsive.spec.js)
- [`playwright.config.js`](playwright.config.js)
- [`tests/live/explorer.live.spec.js`](tests/live/explorer.live.spec.js)
- [`EXPLORER_RELEASE_CHECKLIST.md`](EXPLORER_RELEASE_CHECKLIST.md)
- [`EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md`](EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md)

Remaining:

- Final live sign-off against real indexed data is not complete.
- `npm run test:live` currently fails against the deployed `https://kamet.litho.ai` environment because the live frontend does not yet expose the shared header search and several canonical-route selectors expected by the current repo.
- Wallet connect on the intended production chain still needs deployment-environment sign-off.
- Analytics, logging, and alerting are not fully enabled end-to-end by default.
- Monitored errors still require deployment-time Sentry configuration.

## 17. Fast Triage if the Current Front End Is Broken

Status: Done

Completed:

- The ordered triage workflow is now documented in-repo.
- The runbook explicitly covers:
  - domain and HTTPS validation
  - frontend load vs API/indexer failure separation
  - RPC health
  - indexer freshness
  - search typing correctness
  - router/deep-link failures
  - env var validation
  - UI placeholder triage last

Primary files:

- [`EXPLORER_TRIAGE_RUNBOOK.md`](EXPLORER_TRIAGE_RUNBOOK.md)

Remaining:

- The runbook still needs to be exercised against the live Kamet deployment during production sign-off.

## Minimum Acceptable v1

Status: Mostly implemented, but not yet fully signed off for live production.

Implemented:

- working homepage stats
- global search
- blocks list + detail
- tx list + detail
- address page
- token page
- validator page
- verified contract page
- status link
- responsive UI
- monitored error plumbing

Still needed before calling it live production:

- configure production error monitoring, analytics, logging, and alerting
- complete live-data validation against real indexed services
- close partial items around validator incident depth, production env hardening, and live deployment monitoring sign-off

## Recommended Next Steps

1. Deploy the current frontend bundle and shipped Nginx hardening config, or equivalent ingress or CDN rules, to the intended Kamet environment and rerun `npm run test:live`.
2. Configure production `VITE_SENTRY_DSN`, `VITE_SENTRY_ALLOWED_HOSTS`, `VITE_SENTRY_RELEASE`, analytics, alerting, and the final status metrics endpoint values expected for launch.
3. Execute the human pass in [`EXPLORER_ACCESSIBILITY_DEVICE_QA.md`](EXPLORER_ACCESSIBILITY_DEVICE_QA.md) and record results before launch approval.
4. Improve section 8 incident richness further only if the public status service starts exposing deeper history, component uptime, maintenance metadata, or richer per-event fields than the frontend already consumes.
5. Use [`EXPLORER_RELEASE_CHECKLIST.md`](EXPLORER_RELEASE_CHECKLIST.md), [`EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md`](EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md), and [`EXPLORER_TRIAGE_RUNBOOK.md`](EXPLORER_TRIAGE_RUNBOOK.md) as the release and first-response path for the live deployment.

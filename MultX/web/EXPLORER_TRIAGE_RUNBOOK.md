# Kamet Explorer Triage Runbook

Updated: 2026-04-19

Scope: frontend-first troubleshooting order for the `kamet-explorer` application. Use this to separate deployment, API, routing, and UI failures before changing code.

## Triage Order

1. Confirm the domain resolves and HTTPS is valid.
2. Check whether the frontend loads but API or indexer calls fail.
3. Verify chain RPC is healthy.
4. Verify indexer ingestion is current.
5. Verify the search endpoint returns the correct object typing.
6. Check router and deep-link failures.
7. Check environment variables for API base URL, chain ID, explorer branding, and wallet config.
8. Fix broken tables, cards, and placeholders last.

## 1. Domain and HTTPS

Goal: prove the issue is not a DNS, certificate, or reverse-proxy failure.

Checks:

- Open the deployed root URL and confirm the browser does not show certificate or mixed-content warnings.
- Confirm the expected domain resolves to the active frontend deployment.
- Confirm HTTPS redirects are working at the edge or load balancer.
- Verify the SPA fallback is active for direct deep links such as `/block/<height>` and `/tx/<hash>`.

What good looks like:

- The homepage loads over HTTPS without browser warnings.
- Pasting a deep link into the browser loads the app shell instead of a server 404.

If this fails:

- Fix DNS, TLS, proxy, or static hosting configuration before touching frontend code.

## 2. Frontend Load vs API or Indexer Failure

Goal: determine whether the shell is broken or the data layer is degraded.

Checks:

- Load `/` and confirm the header, layout, and search UI render.
- Open browser devtools and inspect network calls for explorer summary, block, transaction, token, validator, contract, and status requests.
- Distinguish:
  - app shell missing or blank page
  - app shell present but panels are delayed, empty, or erroring

What good looks like:

- The layout renders.
- API requests resolve with expected payloads or show friendly degraded states.

If this fails:

- Blank shell or runtime crash: inspect client errors first, then route boot and build artifacts.
- Shell renders but data panels fail: continue to RPC, indexer, and API checks below.

## 3. RPC Health

Goal: confirm chain reads are not failing upstream.

Checks:

- Verify the configured RPC and REST endpoints respond.
- Check latest block height and compare it with the explorer homepage and network page.
- Confirm wallet chain configuration still matches the intended Kamet chain ID and RPC set.

What good looks like:

- RPC and REST endpoints respond within normal latency.
- Latest height is advancing.

If this fails:

- Treat this as an infrastructure or chain-health issue, not a frontend table/card issue.

## 4. Indexer Freshness

Goal: confirm indexed explorer data is current enough for homepage stats, search, blocks, transactions, contracts, and tokens.

Checks:

- Compare chain latest height with explorer freshness indicators such as indexed-through block and last updated time.
- Check whether delayed-state banners or freshness pills are showing across key pages.
- Verify recent blocks and transactions update over websocket or polling fallback.

What good looks like:

- Indexed height is close to chain height.
- Latest blocks and transactions continue to advance.

If this fails:

- Mark the issue as indexer lag or ingestion failure.
- Avoid “fixing” the UI by hardcoding zeroes or placeholders.

## 5. Search Object Typing

Goal: ensure global search and direct result resolution still classify objects correctly.

Checks:

- Test known examples for:
  - block height
  - tx hash
  - wallet address
  - token symbol
  - token contract
  - validator operator address
- Confirm malformed values produce friendly invalid states.
- Confirm unsupported values such as validator consensus addresses produce explicit unsupported-type states.

What good looks like:

- Numeric input routes to a block page.
- Full tx hash routes to transaction detail.
- Address-like input resolves to address, token, or contract detail appropriately.

If this fails:

- Inspect search parsing and `src/helpers/explorerErrors.js`.
- Inspect search resolution and `src/services/explorerDataService.js`.

## 6. Router and Deep-Link Failures

Goal: isolate routing regressions from data regressions.

Checks:

- Paste these directly into the browser:
  - `/block/:heightOrHash`
  - `/tx/:hash`
  - `/address/:address`
  - `/token/:contract`
  - `/validator/:operator`
  - `/contract/:address`
  - `/search?q=<query>`
- Confirm legacy compatibility redirects still work if old links exist.
- Confirm not-found routes land on the dedicated 404 view.

What good looks like:

- Direct deep links boot the app and render the intended page.
- Invalid route params render a friendly in-app error state instead of a crash.

If this fails:

- Inspect `src/routes/routeConfig.jsx`, `src/Main.jsx`, and `nginx.conf`.

## 7. Environment Variable Validation

Goal: catch misconfiguration before code changes.

Checks:

- Verify the deployed environment defines the expected explorer API base URL.
- Verify chain branding, footer links, chain ID, RPC URLs, wallet config, and status URL values.
- Verify Sentry DSN or equivalent monitoring config is present if monitored errors are expected.

What good looks like:

- The app points at the intended Kamet services and branding values.
- Wallet connect and add-network flows target the correct chain.

If this fails:

- Fix deployment configuration before changing application logic.

## 8. UI Tables, Cards, and Placeholders Last

Goal: avoid treating symptoms before root cause.

Only work here after the earlier steps are clean.

Checks:

- Verify tables show the expected columns and row links.
- Verify skeletons, empty states, retry buttons, and delayed banners are rendering correctly.
- Verify no placeholder zeroes are shown when data is unavailable.

What good looks like:

- UI states accurately reflect the backend condition.
- Visual bugs are limited to presentation rather than missing data contracts.

If this fails:

- Fix the UI state mapping, not the upstream data source assumptions.

## Repo References

- `src/routes/routeConfig.jsx`
- `src/Main.jsx`
- `src/helpers/explorerErrors.js`
- `src/services/explorerDataService.js`
- `src/hooks/useRealtimeRefresh.js`
- `tests/e2e/explorer.e2e.spec.js`
- `nginx.conf`

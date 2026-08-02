# Kamet Explorer Release Checklist

Updated: 2026-04-20

Scope: lean production readiness for the `kamet-explorer` frontend. This checklist separates automated verification from manual checks and environment-dependent sign-off items.

## Automated Checks

Run these in the repo before a release candidate is promoted:

```powershell
npm run test:ci
```

Equivalent step-by-step commands:

```powershell
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

Expected result:

- All commands pass.
- Mocked e2e coverage validates:
  - homepage renders
  - the skip link moves focus to the main content region
  - representative desktop explorer routes pass a serious/critical accessibility smoke scan
  - the canonical blocks route exposes the shared virtualized block-feed wrapper
  - canonical deep links render
  - address, token, validator, contract, search, and network pages render
  - the shared global search input is exposed with an accessible label
  - address activity tabs and token filters expose named tab panels for the active content region
  - shared-header search resolves known block, tx, address, validator, and token inputs
  - malformed deep links and unsupported object types show friendly states
  - footer trust links and status badge are visible
  - unexpected `console.error`, `pageerror`, and unapproved 404s are not emitted during the mocked flows

Live sign-off is intentionally separate from `test:ci`:

```powershell
npm run test:live
```

Current known status:

- On 2026-04-20, `npm run test:live` failed against `https://kamet.litho.ai` because the deployed frontend did not yet expose the repo's current shared header search and several canonical-page selectors expected by the live suite.
- Run the live suite again only after the intended frontend and edge config have been rolled out.

## Manual Pre-Release Checks

Run these against the intended Kamet deployment or a staging environment that mirrors it closely.

Use `EXPLORER_ACCESSIBILITY_DEVICE_QA.md` to record the manual accessibility and real-device pass while you execute the checks below.

### Routing and Search

- Confirm these routes load directly when pasted into the browser:
  - `/block/:heightOrHash`
  - `/tx/:hash`
  - `/address/:address`
  - `/token/:contract`
  - `/validator/:operator`
  - `/contract/:address`
  - `/search?q=<query>`
- Confirm the global search bar is visible in the shared header on major pages.
- Confirm known search inputs resolve correctly for:
  - block
  - transaction
  - wallet
  - token
  - validator

### Data Freshness and Explorer Behavior

- Confirm latest block auto-updates.
- Confirm latest transaction feed auto-updates.
- Confirm freshness metadata shows indexed-through height and last-updated time.
- Confirm delayed banners appear when indexer lag is simulated or observed.
- Confirm the app shows real indexed values instead of placeholder zeroes.

### UI and UX

- Confirm empty states are styled on malformed, missing, unsupported, and delayed cases.
- Confirm the automated axe smoke remains green or investigate any newly introduced serious/critical violations before release.
- Execute the manual accessibility and device matrix in `EXPLORER_ACCESSIBILITY_DEVICE_QA.md`.
- Confirm copy buttons work for hashes and addresses on major explorer pages.
- Confirm the skip link moves focus to the main content region from the shared shell.
- Confirm the shared global search input is labelled accessibly and announces live validation hints or errors.
- Confirm address activity tabs and token filters expose the correct active panel content after keyboard and pointer interaction.
- Confirm mobile layout works across home, block, tx, address, token, validator, contract, search, and network routes.
- Confirm sticky header/search behavior works without overlap or clipping.
- Confirm footer links render and open the intended destinations.

### Wallet and Contract Gating

- Confirm wallet connect works on the intended Kamet chain.
- Confirm add-network uses the expected chain metadata.
- Confirm contract write UI stays hidden or locked unless the wallet is connected on the correct network.

### Production Sanity

- Confirm no unexpected console errors appear on major pages.
- Confirm the status badge or status link is visible.
- Confirm not-found routes land on the dedicated 404 page.
- Confirm the deployed frontend returns the expected security headers from `EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md`.

## External or Environment-Dependent Sign-Off

These items are required for live production confidence, but they depend on deployment environment, backend services, or monitoring infrastructure rather than frontend code alone.

- Configure `VITE_SENTRY_DSN` if monitored client errors are required in production.
- Verify analytics is enabled if analytics is part of the release gate.
- Verify logging and alerting are enabled end to end.
- Verify the public status page reflects the intended service state.
- Verify indexed data is current against real Kamet infrastructure.
- Verify backend or edge rate limiting is enabled where required.
- Verify HTTPS-only behavior is enforced by the deployed topology.
- Verify `npm run test:live` passes against the intended Kamet deployment after release rollout.
  - Current blocker: the live Kamet deployment still appears to be serving an older frontend shell than the current repo.

## Recommended Release Flow

1. Pass automated checks locally or in CI.
2. Run the manual pre-release checks against staging or the target deployment.
3. Run the security and env review in `EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md`.
4. Review the blocked external sign-off items with whoever owns infra and monitoring.
5. If production symptoms appear, use `EXPLORER_TRIAGE_RUNBOOK.md` before changing UI code.

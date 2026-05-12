# Phase 6 — Test Strategy & Ephemeral Environments

> **Status:** **100% Dev-Infra ceiling** (2026-05-12). PR preview environments
> remain K8s-blocked (out-of-scope per the Out-of-Scope table) but everything
> achievable on EC2 + docker-compose is shipped: 254 unit tests, all 21 api
> endpoints covered, chain-state fixture corpus + integration replayer, flake
> quarantine, E2E smoke, coverage dashboards.
>
> First written at ~70% on 2026-05-11. See [§ Updates](#updates-since-first-writing-2026-05-11) below for what shipped after.

## Updates since first writing (2026-05-11)

Between this doc's first publication and 2026-05-12 (P6 ceiling), the
test surface grew as follows:

### Coverage broadened: 220 → 254 unit tests, all 21 api endpoints

- **api 134** (was 122). New `routes-remaining.test.ts` covers
  `/stats/summary`, `/txs`, `/address/:address*`, `/tokens` list, and
  `/debug` — the 8 routes the original write-up flagged as needing
  handler tests. Multi-query supertest mocks with fake timers age out
  per-route module caches between tests.
- **indexer 41** (was 33). `indexBlock` exercised end-to-end with
  `vi.mock('pg')` + stubbed fetch (BEGIN/INSERT/COMMIT flow,
  lowercasing, rollback, `replaceExisting` DELETE order).
- **explorer 79**. New `lib/format`, `lib/tx` helper coverage plus
  jsdom-bootstrapped component tests for `Pagination` (7) and
  `CopyButton` (4).

### Chain-state fixture corpus + integration replayer (2026-05-12)

`Makalu/api/src/__tests__/integration/fixtures/`:

- `chain-state.json` — 10 deterministic blocks at 525ms cadence,
  15 cosmos+EVM transactions, 5 validators including one jailed.
  Hand-crafted hashes `0x0000…<height>` so assertion failures point
  at a specific block.
- `schema.sql` — idempotent `CREATE TABLE IF NOT EXISTS` matching the
  indexer's INSERT shapes.
- `load.ts` — `applySchema(pool)` + `loadFixtures(pool, corpus)`
  helpers + typed corpus interfaces.
- `chain-state.integration.test.ts` — 7 tests covering `/api/blocks`
  (sort/paginate/clamp/shape), `/api/validators` (token sort, jailed
  last, voting-power conversion, commission %), plus a cross-cutting
  consistency property (`sum(block.txCount) == |transactions|`).

Vitest hardening: `fileParallelism: false` under `INTEGRATION_TESTS=1`
so two integration files don't `TRUNCATE` each other; tightened
`include` so `load.ts` isn't picked up as an empty test file.

### Integration suite auto-fires on PRs (2026-05-12)

`integration.yaml` promoted from PR-label-only to a path-based PR
gate once proven green end-to-end (`sslmode=disable` fix + fixture
corpus). Now auto-runs on PRs touching `Makalu/{api,indexer}/**`,
`docker-compose.test.yml`, or the workflow itself.

### Flaky-test quarantine (2026-05-12)

`.test-quarantine.yaml` + `scripts/process-test-results.mjs` splits
vitest failures into real vs quarantined via an allowlist; appends a
"Quarantined Failures" subtable to the sticky PR comment; emits
`::warning::` for entries older than 30 days. Empty allowlist today.
Runbook: `docs/governance/test-quarantine.md`.

### `make integration-test` one-command setup (2026-05-12)

Three new Makefile targets — `integration-up`, `integration-down`,
`integration-test` — boot the ephemeral Postgres on `:5433` and run
the api integration suite in one command. Local parity with CI.

### Test summary in PR comments (polished 2026-05-12)

`ci.yaml` test job builds `/tmp/pr-summary.md` with per-package test
counts + coverage table; writes to `$GITHUB_STEP_SUMMARY` and
posts/updates a sticky PR comment (header `ci-test-summary`).

The point-in-time content below describes the 2026-05-11 snapshot.

---

## What this phase covers

The phase scope from the L1 Developer Infrastructure work plan: stand up a real
test pyramid for the Makalu services (api / indexer / explorer), gate the
publish pipeline on automated checks, and give developers a fast feedback loop
locally and in CI.

Coming into this phase the repo had **3 tests total** across all services and no
coverage instrumentation. Leaving it: **220 tests**, three layers of integration
(unit → handler → end-to-end), per-package coverage uploaded to CI, and a
nightly flake detector.

## What we built

### Unit + handler tests (220 total)

| Package | Tests | What's covered |
|---------|------:|----------------|
| `Makalu/api` | 103 | Pure helpers (formatting, address normalization, tx-hash detection) + 13 route handlers exercised end-to-end via `supertest` with `db.query` / `fetch` mocked. |
| `Makalu/indexer` | 38 | Helpers (event attribute decoding, validator math) + the `indexBlock` pipeline run against `vi.mock('pg')` and stubbed RPC — exercises BEGIN/INSERT/COMMIT order, error rollback, replaceExisting DELETE order, lowercasing rules. |
| `Makalu/explorer` | 79 | `lib/format`, `lib/tx`, plus two React components (`Pagination`, `CopyButton`) under jsdom + `@testing-library/react`. |

All three packages run on **vitest** with the **v8** coverage provider. Initial
baseline: api ~31% lines, indexer ~33% lines, explorer ~70% on `lib/*`.

### Integration tests (opt-in, dockerized)

`Makalu/docker-compose.test.yml` provisions an ephemeral Postgres on port 5433.
`Makalu/api/src/__tests__/integration/blocks.integration.test.ts` runs against
real SQL — not mocks — and is gated by `INTEGRATION_TESTS=1` so it stays out of
the default `pnpm test` path.

CI workflow `.github/workflows/integration.yaml` runs the suite on
`workflow_dispatch` or when a PR is labelled `integration`. Opt-in by design —
the suite spins a real container, so we don't burn it on every push.

### End-to-end smoke (Playwright)

`e2e/` is a standalone Playwright project with a single smoke spec against
`https://makalu.litho.ai`: homepage loads, search input is reachable, blocks
page renders. `.github/workflows/e2e.yaml` runs nightly and on
`workflow_dispatch`.

This is intentionally narrow — it's a "the production site is alive" check, not
a UI regression harness. Broader E2E coverage is a separate body of work.

### Coverage dashboard

The CI test step emits a per-package coverage table in `$GITHUB_STEP_SUMMARY`
and uploads the `coverage/` HTML directory as an artifact (90-day retention).
Open the run → Summary tab to see the numbers; open the artifact to drill in.

### Flake tracker

`scripts/flake-tracker.sh` + `.github/workflows/flake-tracker.yaml` (daily cron)
download the last 10 CI runs' JSON-reported test results and flag any test name
that appears with mixed pass/fail across runs. Output is posted as a workflow
summary; nothing today is auto-quarantined.

## How to use what was built

**Run tests locally:**

```bash
# All three packages
cd Makalu && pnpm turbo run test

# Just one
pnpm --filter @lithosphere/api test

# With coverage
pnpm --filter @lithosphere/api test:coverage
```

**Run the dockerized integration suite:**

```bash
cd Makalu
docker compose -f docker-compose.test.yml up -d
INTEGRATION_TESTS=1 pnpm --filter @lithosphere/api test
docker compose -f docker-compose.test.yml down
```

**Run the E2E smoke locally:**

```bash
cd e2e
pnpm install
pnpm test
```

**Read the flake report:** open the most recent
[Flake Tracker workflow run](https://github.com/KaJLabs/Lithosphere/actions/workflows/flake-tracker.yaml)
and check the summary.

## Why it matters

- **Catch regressions before deploy.** The handler tests run `supertest` against
  the actual Express app — a real router, real middleware, real error paths —
  with only the database and external HTTP boundaries mocked. Most bugs in the
  api are reachable here.
- **Detect indexer drift.** The `indexBlock` pipeline test is the single most
  load-bearing one in the repo: it pins the contract between the indexer and
  Postgres, so a schema change or query-order rewrite fails CI loudly.
- **Operational signal.** The nightly Playwright smoke + the flake tracker are
  cheap and detect "is prod still working" / "are tests reliable" without a
  human looking.
- **Coverage as a floor, not a ceiling.** The numbers are deliberately low
  today — the goal of this phase was *infrastructure*, not chasing a coverage
  percentage. The dashboard makes it easy to set per-package floors later.

## Files & commits

| Path | Purpose |
|------|---------|
| `Makalu/api/src/__tests__/` | api handler + helper suites |
| `Makalu/indexer/src/__tests__/` | indexer pipeline + helper suites |
| `Makalu/explorer/__tests__/`, `Makalu/explorer/lib/__tests__/` | explorer component + lib suites |
| `Makalu/docker-compose.test.yml` | ephemeral Postgres for integration tests |
| `e2e/` | Playwright project + smoke spec |
| `scripts/flake-tracker.sh` | flake detector script |
| `.github/workflows/integration.yaml` | opt-in integration runner |
| `.github/workflows/e2e.yaml` | nightly Playwright smoke |
| `.github/workflows/flake-tracker.yaml` | daily flake report |

Commits: `a0931c6` (88 helper tests), `22f2298` (12 handler tests),
`d9ee66b` (21 more handler tests), `412a114` (full deliverable set).

## Deferred work

**PR-based preview environments** — the original spec asked for "every PR spins
a working preview with URL & test summary in ≤ 10 minutes". Production is
**EC2 + docker-compose**, not Kubernetes, so the standard "namespace per PR on
managed cluster" pattern doesn't apply here without first standing up a
cluster (~2–3 weeks of infra work). The dockerized integration scenario covers
the immediate "hermetic test env" need; revisit preview envs once Phase 4 lands
an EKS cluster.

**Broader API endpoint coverage.** 8 endpoints (`/stats/summary`, `/txs`,
`/txs/:hash`, `/address/*`, `/tokens` list, `/debug`) need multi-query
orchestration that's better suited to integration tests than handler-level
mocks. Tracked separately.

**Data fixtures / chain-state replayers.** Deferred — the dockerized integration
scenario plus the production smoke spec cover the immediate use cases.

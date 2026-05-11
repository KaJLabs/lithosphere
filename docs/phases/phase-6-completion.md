# Phase 6 — Test Strategy & Ephemeral Environments

> **Status:** ~70% (2026-05-11). Unit tests, coverage, flake tracking, integration
> scaffolding, and a Playwright smoke spec all landed. PR preview environments
> are explicitly deferred — see [§ Deferred work](#deferred-work).

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

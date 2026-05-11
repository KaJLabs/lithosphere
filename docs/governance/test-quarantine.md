# Test Quarantine

A flaky test — one that passes sometimes and fails sometimes against the
same code — is one of the few ways CI can legitimately lie to you. Without
a quarantine, the team's options are:

1. **Block PRs** until the flake is fixed (kills velocity).
2. **Ignore the failure** (trains everyone to ignore CI; real regressions
   slip through).
3. **Delete the test** (loses real coverage).

Option (4) is the quarantine — keep running the test (so we know if it
stabilises) but exempt it from blocking the build. The team gets honest
signal on the rest of the suite, and the flake stays visible in the PR
summary as nagging proof that the work isn't done.

The mechanism lives at three files:

- **Policy:** [`.test-quarantine.yaml`](../../.test-quarantine.yaml) (repo root)
- **Processor:** [`scripts/process-test-results.mjs`](../../scripts/process-test-results.mjs)
- **CI gate:** the `Process test results against quarantine` step in
  [`.github/workflows/ci.yaml`](../../.github/workflows/ci.yaml)'s `test` job

## When to quarantine

**Symptoms of a flake** (quarantine candidate):

- The test passes on rerun without any code change.
- It fails differently on different runs (different assertion, different
  timeout, different stack).
- It involves timing, parallelism, network, randomness, or a shared
  filesystem.

**Symptoms of a regression** (do NOT quarantine — fix or revert):

- Same assertion fails consistently.
- The test was passing on `main` and fails the moment a specific PR
  branches off.
- The failure narrative matches a recent code change in the same area.

If unsure, run the test 10× locally:

```bash
cd Makalu
for i in $(seq 1 10); do
  pnpm --filter @lithosphere/api test -- --run -t "test name fragment" || echo "FAILED on run $i"
done
```

Mixed results → flake. Consistent fail → regression.

## How to add an entry

1. Find the test's `fullName` — vitest formats it as
   `<describe path> > <it title>`. The
   [`scripts/flake-tracker.sh`](../../scripts/flake-tracker.sh) report
   uses the same format, so you can copy-paste the name directly from a
   nightly flake-tracker output.

2. Edit [`.test-quarantine.yaml`](../../.test-quarantine.yaml):

   ```yaml
   entries:
     - package: api                    # api / indexer / explorer
       testName: "GET /api/blocks > returns mapped blocks with default pagination"
       reason: "Times out against shared CI runner under load — issue #N"
       since: 2026-05-12               # today's date, YYYY-MM-DD
       owner: '@bachal-abro'           # the person responsible for un-quarantining
   ```

3. Commit with a descriptive message:

   ```bash
   git commit -m "test(api): quarantine flaky /api/blocks pagination test (#N)"
   ```

4. Push. The CI summary on the PR will now show the test failure under
   "Quarantined Failures" if it fails again. The build doesn't block.

5. **File the underlying issue.** A quarantine entry without an open
   issue is just hiding a bug. The runbook 30-day rule (below) treats
   any entry without an issue link in `reason` as a code smell.

## The 30-day stale-entry rule

Every entry's `since` field is checked on each CI run. Entries older
than 30 days emit `::warning::` annotations to the workflow run:

```
::warning::Stale quarantine entry (45 days): api > GET /api/blocks > returns mapped blocks (owner: @bachal-abro)
```

The stale-entry warnings also surface in the PR sticky comment under a
"Stale quarantine entries" subtable.

The expectation: **30 days is the soft deadline.** Within that window,
either:

- Fix the underlying flake (preferred). Remove the entry.
- Move the test under `vitest.config.ts`'s `exclude` if the flake is
  inherent to the test design and a rewrite is out of scope. Add a
  follow-up issue tracking the rewrite.
- Escalate to a team-wide call if the test is fundamentally racing
  against infra outside our control.

A stale-entry warning that lingers more than 60 days is grounds for
auto-escalation — open an issue on the entry's owner and tag the dev
infra lead.

## How to remove an entry

1. Verify the underlying flake is fixed:

   ```bash
   # Local run 10× — should be 10/10 green
   cd Makalu && for i in $(seq 1 10); do
     pnpm --filter @lithosphere/api test -- --run -t "<test name fragment>"
   done
   ```

2. Watch the nightly flake-tracker workflow run for a week. The test
   should NOT appear in its "tests with mixed pass/fail status" list.

3. Delete the entry from `.test-quarantine.yaml`. Commit with a
   message linking the original issue:

   ```bash
   git commit -m "test(api): un-quarantine /api/blocks pagination test — fixed in #N"
   ```

4. On the next CI run, the Test job loses the quarantine cover for
   that test. If it fails again, you've just regressed — revert the
   un-quarantine commit and reopen the issue.

## Relationship to `flake-tracker.sh`

| | flake-tracker.sh | .test-quarantine.yaml |
|-|-|-|
| **Role** | Detect | Suppress |
| **Run** | Nightly (cron via `.github/workflows/flake-tracker.yaml`) | Every CI run |
| **Action** | Reports tests with mixed pass/fail across last 10 runs | Splits failures into real vs quarantined; gates build |
| **Workflow** | Surfaces candidates | Accepts them after human review |

The flake-tracker finds candidates; the quarantine accepts the human
decision. The two are complementary — neither alone is enough.

## Current quarantine state

As of 2026-05-12, the allowlist is **empty**. The mechanism ships
ready-to-use; the first real quarantine entry will be filed as flakes
are observed in CI.

## Why not just retry the test?

vitest supports `test.retry(3)`. We considered this and rejected it for
the standard SLO-style reasons:

- A retried test that passes on attempt 3 still ran 3× the work,
  burning CI minutes and confusing flake-tracker statistics.
- Retries hide the flake. The quarantine surfaces it (PR summary +
  stale-entry warnings).
- Retries are a per-test author decision; the quarantine is a team-level
  policy with explicit owner + deadline.

Either mechanism works in isolation; quarantining is the more visible
one and was chosen for that reason.

## Related

- [`scripts/flake-tracker.sh`](../../scripts/flake-tracker.sh) — flake detector script
- [`.github/workflows/flake-tracker.yaml`](../../.github/workflows/flake-tracker.yaml) — daily cron
- [Phase 6 completion report](../phases/phase-6-completion.md) — test strategy context
- [License Policy runbook](./license-policy.md) — same hand-parsed YAML pattern

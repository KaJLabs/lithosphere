# Phase 7 — Contract Tooling & Safety Rails

> **Status:** ~55% (2026-05-11). Static analysis, gas reporting, ABI export,
> and coverage are wired into CI; deployment-side hardening (multi-sig, EIP-712
> signers, ABI → SDK auto-publish) is deferred.

## What this phase covers

The phase scope: take the Solidity contracts (`Makalu/contracts/`) from "compiles
on a laptop" to "every change is auto-analyzed, gas-budgeted, and ABI-published
in CI." The companion contracts package
(`Makalu/contracts-template/`) is the scaffold consumed by `create-litho-app`.

Coming into this phase: `pnpm hardhat compile` worked locally and that was
about it. Leaving it: every push that touches `Makalu/contracts/**` triggers
compile + test + lint + slither + gas + ABI export + coverage in parallel.

## What we built

### `ci-contracts.yaml` — five-job parallel pipeline

The workflow at `.github/workflows/ci-contracts.yaml` runs the following jobs
on every push affecting `Makalu/contracts/**`:

| Job | What it does | Failure mode |
|-----|--------------|--------------|
| `compile-and-test` | `pnpm hardhat compile && pnpm hardhat test` | Hard fail |
| `lint` | `solhint` + `prettier --check` over `src/` | Hard fail |
| `gas-report` | Tests with `REPORT_GAS=true`, uploads `gas-report.txt` as 30-day artifact | Hard fail |
| `slither` | Slither static analysis emitting SARIF, uploaded to GitHub Security tab | Advisory (SARIF only) |
| `abi-export` | Extracts compiled ABIs from `artifacts/` into a flat `abis/` artifact (30-day retention) | Hard fail |
| `coverage` | `hardhat coverage` — % summary to `$GITHUB_STEP_SUMMARY`, HTML + `coverage.json` as 30-day artifact | Advisory |

The `coverage` job landed in commit `412a114` (2026-05-11) — completes the
"contract tooling" matrix listed in the phase plan.

### Slither SARIF in the Security tab

Slither output is uploaded via `github/codeql-action/upload-sarif`. Findings
show up under **Security → Code scanning** with categorisation by detector
(reentrancy, uninitialized-state, etc.). Currently advisory — the job uploads
but doesn't fail the build — so triage happens in the Security tab rather than
on every PR.

### Gas report as a CI artifact

`REPORT_GAS=true pnpm hardhat test` emits a table per contract method showing
gas used. The CI step uploads the file as `gas-report-<sha>.txt`; if a change
unexpectedly bloats `transfer` from 51k to 78k gas, the diff is one artifact
download away.

### ABI export → downstream consumers

The `abi-export` job copies every compiled ABI from
`Makalu/contracts/artifacts/contracts/src/*.sol/*.json` into a flat directory
and uploads it as a workflow artifact. The SDK build (Phase 8) currently
consumes these from a vendored copy; future work is to wire the CI artifact
directly into the SDK publish pipeline.

## How to use what was built

**See gas costs for a change:**

```bash
# Local
cd Makalu/contracts
REPORT_GAS=true pnpm hardhat test
# or open Actions → CI Contracts → your run → Artifacts → gas-report-*
```

**See coverage for a change:**

```bash
cd Makalu/contracts
pnpm hardhat coverage
open coverage/index.html
# or open Actions → CI Contracts → your run → Artifacts → solidity-coverage-html
```

**See slither findings:**

Open [Security → Code scanning](https://github.com/KaJLabs/Lithosphere/security/code-scanning?query=tool%3ASlither)
and filter by `tool:Slither`.

**Get latest ABIs without rebuilding:**

```bash
gh run download <run-id> -n abis -D ./Makalu/contracts/abis
```

## Why it matters

- **Slither catches the cheap wins.** Reentrancy patterns, unchecked
  externals, unbounded loops — the bugs that have cost the industry billions.
  Even running it in advisory mode forces a human to look at the Security tab
  before merging contract changes.
- **Gas snapshots prevent silent regressions.** Solidity refactors love to
  add a few hundred gas without anyone noticing. The artifact is small and
  the diff is human-readable.
- **Coverage tells you what isn't tested.** Especially valuable for
  templates — contributors who copy `contracts-template/` get a real test
  suite as the starting point, and the coverage report shows them what's
  exercised by `forge test` versus untouched.
- **ABI export decouples contract releases from SDK releases.** The SDK can
  bump to a new ABI artifact without recompiling Solidity locally.

## Files & commits

| Path | Purpose |
|------|---------|
| `.github/workflows/ci-contracts.yaml` | The 6-job pipeline above |
| `Makalu/contracts/hardhat.config.ts` | Hardhat config (compiler, networks, gas reporter) |
| `Makalu/contracts/src/` | LEP100, WLITHO, LITHONative Solidity sources |
| `Makalu/contracts/test/` | Hardhat/Mocha test suites |
| `Makalu/contracts-template/test/foundry/LithoBase.t.sol` | Foundry test seed for the scaffold |

Commit: `412a114` (solidity-coverage wired). Prior CI machinery
(slither + gas + ABI export) was already in place from earlier work.

## Deferred work

- **Deployment framework hardening.** Today it's `pnpm hardhat run scripts/deploy.ts`.
  Future: multi-sig (Safe SDK), Ledger signer support, EIP-712 typed deployment
  manifests. Tracked separately under deployment automation.
- **ABI → SDK auto-publish.** The SDK currently vendors a snapshot of the ABIs.
  Wiring the `abi-export` CI artifact directly into the SDK publish step would
  remove the manual sync step. Small task; not yet scheduled.
- **Slither as a blocking gate.** Today advisory. Promote to blocking once
  the existing findings are triaged and `# slither-disable-next-line` comments
  are added where appropriate.

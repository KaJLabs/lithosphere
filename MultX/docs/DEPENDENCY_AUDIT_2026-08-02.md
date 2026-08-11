# Dependency audit baseline — 2026-08-02

This report records the `npm audit` result immediately after the source was
consolidated into `KaJLabs/Lithosphere`. Counts include direct and transitive
dependencies; severity alone does not prove that a vulnerable code path is
reachable, but every high or critical finding requires triage before an
audited production release.

| Component | Low | Moderate | High | Critical | Total |
|---|---:|---:|---:|---:|---:|
| API | 12 | 5 | 2 | 0 | 19 |
| Contracts/tooling | 25 | 21 | 19 | 3 | 68 |
| SDK | 12 | 5 | 2 | 1 | 20 |
| Web | 24 | 12 | 17 | 1 | 54 |

Commands were run from each component directory with the lockfiles included
in this import:

```bash
npm ci
npm audit --json
```

## Release gate

- Do not use `npm audit fix --force` without reviewing breaking changes.
- Triage direct versus transitive findings and runtime versus development-only
  exposure.
- Upgrade or replace affected packages, then rerun tests, builds and contract
  analysis.
- Record any accepted residual risk with owner, rationale and expiry.
- Independent contract and operations audits remain required; this dependency
  scan is not a security audit.

MultX remains disabled on LITHO mainnet until this gate and the release gates
in `MultX/README.md` are closed.

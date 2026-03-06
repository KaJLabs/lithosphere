# CI Cache Strategy

> How Lithosphere CI pipelines use caching to keep PR times under 10-15 minutes.

## Cache Layers

| Layer | Tool | Key | TTL | Workflow |
|-------|------|-----|-----|----------|
| pnpm store | `actions/cache` | `os-pnpm-store-{lockfile hash}` | 7 days (LRU) | ci.yaml |
| node_modules | `actions/cache` | `os-node-modules-{lockfile hash}` | 7 days (LRU) | ci.yaml |
| Turborepo local | `actions/cache` | `os-turbo-{sha}` | 7 days (LRU) | ci.yaml |
| Docker layers | BuildKit GHA cache | `type=gha` | repo-scoped | publish-images.yaml |
| Hardhat cache | pnpm store (includes hardhat cache dir) | lockfile-based | per-install | ci-contracts.yaml |
| Foundry cache | Not cached in CI (fast enough) | N/A | N/A | ci-contracts.yaml |

## How It Works

### pnpm Store Cache
The pnpm content-addressable store is cached between runs. On cache hit, `pnpm install --frozen-lockfile` resolves in ~3 seconds instead of 30+.

```yaml
- name: Get pnpm store directory
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: ${{ runner.os }}-pnpm-store-
```

### Turborepo Cache
Turbo hashes each task's inputs (source files, dependencies, env vars) and skips unchanged packages. The `.turbo` directory is cached between CI runs so even cross-PR builds benefit from prior results.

### Docker Layer Cache
`docker/build-push-action` uses GitHub Actions cache backend (`type=gha`) for BuildKit layer caching. This makes incremental image builds 2-5x faster.

### Hardhat Compilation Cache
Hardhat's `cache/` directory stores compilation results. When source files haven't changed, `hardhat compile` is a no-op. This is included in the pnpm workspace install and cached via node_modules.

## Cache Invalidation

- **pnpm store**: Invalidated when any `pnpm-lock.yaml` changes (new deps)
- **node_modules**: Same as pnpm store
- **Turbo**: Keyed by commit SHA; `restore-keys` prefix allows partial hits from prior commits
- **Docker**: Invalidated per-layer when Dockerfile or COPY sources change

## Parallelization Strategy

The CI is split into independent parallel jobs:

```
ci.yaml:         build ─┬─ test
                        ├─ typecheck
                 lint ──┘
                 gitleaks (independent)

ci-contracts:    compile ─┬─ test
                          ├─ gas-report
                          ├─ slither
                          └─ abi-export
                 lint (independent)

ci-sdk:          Node 18 ┐
                 Node 20 ├─ parallel matrix
                 Node 22 ┘
                 size-check (independent)
```

## Flaky Test Quarantine

When a test is identified as flaky:

1. Add `skip` annotation with a tracking issue link
2. Move to a `__flaky__/` directory (excluded from CI by default)
3. Run flaky tests in a separate non-blocking job
4. Fix and re-enable within one sprint

Turbo's `inputs` config means only changed packages re-run tests, which naturally reduces flake exposure.

## Target CI Times

| Pipeline | Target | Mechanism |
|----------|--------|-----------|
| Contracts (PR) | < 10 min | Parallel compile/test/lint/slither |
| Services (PR) | < 15 min | Turbo cache + parallel jobs |
| SDK (PR) | < 5 min | Fast tsup build, small test suite |

# Release Process — SDK packages

This document covers the operational mechanics of releasing
`@lithosphere/blockchain-core` and `@lithosphere/sdk` to npm. The
companion runbook for emergency / rotation events lives at
[`key-rotation-runbook.md`](./key-rotation-runbook.md).

## When to release

- **Patch (`0.1.x`)** — bug fixes only, no API surface changes.
- **Minor (`0.x.0`)** — additive API changes (new method on `LithoClient`,
  new network entry, new exported type). Existing callers must still
  compile without modification.
- **Major (`x.0.0`)** — breaking change. Reserve for v1.0.0 and beyond;
  for v0.x, document breaking changes in CHANGELOG and bump the minor.

`@lithosphere/sdk` depends on `@lithosphere/blockchain-core` via `workspace:*`.
On publish, pnpm rewrites this to the exact published version, so both packages
must release together at the same version number.

## Prerequisites (one-time)

1. **`NPM_TOKEN` secret** must be set in the `KaJLabs/Lithosphere` repo settings
   (Settings → Secrets and variables → Actions). The token must have
   **Automation** type with publish access to the `@lithosphere/*` scope.
   - Generate at https://www.npmjs.com/settings/<user>/tokens.
   - Select "Automation" (granular tokens also work if scoped to the org).
   - The release workflow checks for `NPM_TOKEN` and emits a non-fatal warning
     when it's absent (so missing-secret releases don't fail the GitHub
     release publication — they just skip the npm push).

2. **OIDC / provenance** — the workflow uses `--provenance` which requires
   `permissions: id-token: write`. No additional secret is needed beyond
   `NPM_TOKEN`. Provenance attestations show up on the package page as a
   "verified" badge linking back to the GitHub Actions run.

3. **npm org membership** — confirm the GitHub Actions automation user is a
   maintainer of the `@lithosphere` scope on npm (`npm access ls-collaborators @lithosphere/sdk`).

## Cutting a release

Releases are now driven by **release-please** parsing conventional commits.
The manual `git tag` flow at the bottom of this section still works, but
the automated path is the default.

### Automated path (preferred)

1. Land work on `main` using conventional-commit messages. The types
   recognised by `.github/release-please-config.json` are:
   - `feat:` — minor bump (or patch while pre-1.0 per
     `bump-minor-pre-major`).
   - `fix:` — patch bump.
   - `feat!:` / footer `BREAKING CHANGE:` — major bump.
   - Visible-but-non-bumping sections: `sec`, `obs`, `deploy`, `dx`, `sdk`, `perf`.
   - Hidden from the changelog: `ci`, `test`, `docs`, `gov`, `chore`, `refactor`, `style`, `build`.

2. Each push to `main` runs `.github/workflows/release-please.yaml`,
   which opens (or updates) a single **Release PR** named
   `chore(main): release <next-version>`. The PR:
   - Bumps `.github/.release-please-manifest.json` from the current
     version to the next.
   - Writes/updates `CHANGELOG.md` with one section per type.

3. **Review the Release PR.** If the proposed version or notes look
   right, merge it. release-please will:
   - Push a `v<next-version>` tag (e.g. `v1.28.0`).
   - Create a corresponding GitHub Release.

4. The tag push triggers the existing `Developer Preview Release`
   workflow (`.github/workflows/release.yaml`) which syncs the SDK
   package versions, builds, packs, and publishes both packages to npm
   with provenance.

> If the proposed bump is wrong (e.g. release-please saw a `feat:` but the
> change is actually internal), amend or revert the offending commit
> message on `main` and push again — the Release PR will refresh.

### Manual path (fallback)

1. Update `CHANGELOG.md` in both packages with the new version's notes.
2. Verify locally:
   ```sh
   cd Makalu
   pnpm --filter @lithosphere/blockchain-core --filter @lithosphere/sdk run build
   pnpm --filter @lithosphere/blockchain-core --filter @lithosphere/sdk run test
   ```
3. Tag and push:
   ```sh
   git tag -a v0.1.1 -m "chore(release): v0.1.1"
   git push origin v0.1.1
   ```
4. The `Developer Preview Release` workflow runs automatically. It:
   - Syncs both packages' `package.json` versions to the tag.
   - Builds + tests both packages.
   - Packs tarballs + uploads as a GitHub Release.
   - Publishes both packages to npm (in order: `blockchain-core`, then `sdk`).

5. Verify the publish:
   ```sh
   npm view @lithosphere/blockchain-core@0.1.1
   npm view @lithosphere/sdk@0.1.1
   ```

## Dry run (without publishing)

Use `workflow_dispatch` to run the release workflow without tagging:

- GitHub UI → Actions → Developer Preview Release → Run workflow.
- The `publish_npm` job is gated on `startsWith(github.ref, 'refs/tags/v')`,
  so it will be **skipped** for `workflow_dispatch` runs.
- The `validate` and `publish_github_release` jobs still execute against your
  branch, including the smoke test that installs both tarballs into a scratch
  project and asserts the canonical exports (`LithoClient`, `NETWORKS`,
  `LithoError`, `ErrorCode`) are reachable.

## Rolling back

`npm unpublish` is **only allowed within 72 hours** of publishing and only if
no other public package depends on the version. Prefer to publish a patch:

```sh
git tag -a v0.1.2 -m "chore(release): v0.1.2 — revert v0.1.1 (see CHANGELOG)"
git push origin v0.1.2
```

For genuine emergencies (e.g. a leaked secret in a published tarball),
follow the [key-rotation runbook](./key-rotation-runbook.md) for the
secret in question and document the incident via the
[PIR template](./pir-template.md).

## Related

- Issue templates: `.github/ISSUE_TEMPLATE/`
- RFC template: `docs/governance/rfc-template.md`
- Security policy: `SECURITY.md`

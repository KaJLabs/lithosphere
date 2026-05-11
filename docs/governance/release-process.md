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

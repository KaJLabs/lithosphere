# Artifact catalog

> Last reviewed: 2026-05-12 · Owner: Dev Infra · Linked phase: P3

Single source of truth for every artifact the CI pipelines publish.
A consumer (deploy script, validator-team operator, third-party SDK
integrator) can read this page top to bottom and find:

1. **Where** the artifact lives (registry, scope, naming convention)
2. **How to authenticate** to pull it
3. **What it's signed/attested with** (so they know how to verify)
4. **How long it lives** (retention policy)
5. **A working pull/install command** (copy-pasteable)

Adding a new artifact? Append a section with the same five sub-headings.

---

## 1. Container images (GHCR)

### Where
`ghcr.io/kajlabs/lithosphere-{api,indexer,explorer}`

Built by `.github/workflows/publish-images.yaml` on every push to `main`
and on `workflow_dispatch`.

### Tag scheme
Pushed by `docker/metadata-action@v5`:

| Tag class | Example | Pushed when | Retention |
|-----------|---------|-------------|-----------|
| `latest` | `:latest` | default-branch builds | rolling pointer, replaced |
| `mainnet` | `:mainnet` | every build (default tag) | rolling pointer, replaced |
| `sha-<short>` | `:sha-3a14b0e` | every build | **90 days** then pruned |
| semver | `:v1.27.0`, `:1.27` | tagged releases (`v*`) | **kept forever** |

`sha-<short>` is the only addressable-and-immutable form for arbitrary
commits — use it in the deploy script. Tag pointers like `latest` /
`mainnet` move; verify the resolved digest separately.

Pruning runs weekly via `.github/workflows/ghcr-retention.yaml`
(Sundays 04:00 UTC); manual dry-run via `workflow_dispatch`.
Minimum-versions-to-keep floor is 50 per package as a safety net.

### Authentication

Pulling from GHCR requires either:
- A classic PAT with `read:packages` scope, OR
- A GitHub Actions `GITHUB_TOKEN` (CI workflows only)

```sh
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <username> --password-stdin
```

### Signing & attestations

Every pushed image carries TWO independent signatures:

1. **Cosign keyless sign** (Fulcio + Rekor transparency log)
   ```sh
   cosign verify \
     --certificate-identity-regexp '^https://github\.com/KaJLabs/Lithosphere/' \
     --certificate-oidc-issuer https://token.actions.githubusercontent.com \
     ghcr.io/kajlabs/lithosphere-api:sha-<short>
   ```

2. **SLSA Build L2 provenance** (in-toto, pushed as an OCI artifact)
   ```sh
   gh attestation verify oci://ghcr.io/kajlabs/lithosphere-api:sha-<short> \
     --owner KaJLabs
   ```

Both verifications are wired into `deploy-simple.yaml`'s
`Verify GHCR Image Signatures` step. See `supply-chain.md` for the
governance promotion path from advisory to blocking.

### Reproducibility

All three Dockerfiles pin `node:20-alpine` to a sha256 digest so a
rebuild months later produces a bit-identical image. Refresh the
digest with `scripts/refresh-base-image-digest.sh` when upstream
patches the base layer (Trivy will flag new CVEs as the signal).

### Pull example

```sh
docker pull ghcr.io/kajlabs/lithosphere-api:sha-3a14b0e
```

---

## 2. NPM packages (registry.npmjs.org)

### Where

| Package | Path | Provenance |
|---------|------|------------|
| `@lithosphere/blockchain-core` | `Makalu/packages/blockchain-core` | ✓ |
| `@lithosphere/sdk` | `Makalu/packages/sdk` | ✓ |

Published by `.github/workflows/release.yaml` → `publish_npm` job. Tag-
gated: the job only fires when release-please merges a Release PR and
pushes a `v<next>` tag.

### Authentication

Public packages, no auth required to `pnpm install`.

Internal publishing path uses `NPM_TOKEN` (granular access token, scope
`@lithosphere`). Documented in `docs/governance/release-process.md`.

### Signing & attestations

Published with `npm publish --provenance` so every release has an
[npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
linking back to the exact GitHub Actions run + commit SHA.

Verify:
```sh
npm view @lithosphere/sdk provenance --json
```

### Versioning

release-please controls bumps per conventional-commit type
(see `release-process.md`). Both packages release together with
synchronised versions for now — single rolling Release PR.

### Install example

```sh
pnpm add @lithosphere/sdk
```

---

## 3. Contract artifacts (GitHub Releases)

### Where

Bundle attached to every `v*` GitHub Release at
`https://github.com/KaJLabs/Lithosphere/releases/download/v<X.Y.Z>/lithosphere-contracts-v<X.Y.Z>.tar.gz`.

Built by `release.yaml`'s contract-bundle step from the freshly
compiled Hardhat artifacts.

### Bundle contents

```
lithosphere-contracts-v1.27.0/
├── abi/
│   ├── Lep100.abi.json
│   ├── WLITHO.abi.json
│   └── LITHONative.abi.json
├── bytecode/
│   ├── Lep100.bin
│   ├── WLITHO.bin
│   └── LITHONative.bin
├── metadata/                      # Full hardhat output per contract
│   └── *.json
└── manifest.json                  # { version, tag, chain, commit, generatedAt }
```

### Signing & attestations

- `lithosphere-contracts-v<X.Y.Z>.sha256` accompanies the bundle for
  integrity checking.
- The release itself is GPG-signed by release-please's bot identity.
- Source-of-truth ABIs also ship inside `@lithosphere/blockchain-core`
  on npm; drift between the two surfaces is gated by
  `abi-sync-check` in `ci-contracts.yaml`.

### Download example

```sh
TAG=v1.27.0
curl -fLO "https://github.com/KaJLabs/Lithosphere/releases/download/$TAG/lithosphere-contracts-$TAG.tar.gz"
curl -fLO "https://github.com/KaJLabs/Lithosphere/releases/download/$TAG/lithosphere-contracts-$TAG.sha256"
sha256sum -c "lithosphere-contracts-$TAG.sha256"
tar -xzf "lithosphere-contracts-$TAG.tar.gz"
```

---

## 4. Machine-readable API contracts

### OpenAPI (REST)

- **Source**: `docs/api-reference/openapi.yaml`
- **Drift gates**: `openapi-sync-check` (route set matches Express
  routers) + `openapi-codegen-check` (SDK types regenerable from YAML)
- **Consumer**: `Makalu/packages/sdk/src/generated/openapi.ts`
  (auto-generated, also exported from `@lithosphere/sdk`)

### GraphQL schema

- **Source**: `docs/api-reference/schema.graphql`
- **Drift gate**: `schema-sync-check`
  (`Makalu/api/scripts/verify-schema-in-sync.ts`)

Both files are first-class artifacts: a third-party integrator can
fork the YAML/SDL and codegen against it without running our server.

---

## 5. SBOMs

`anchore/sbom-action` emits an SPDX 2.3 SBOM alongside every image
push in `publish-images.yaml`. The SBOM is attached to the GitHub
Release as `lithosphere-{api,indexer,explorer}-sbom.spdx.json`.

Verify a SLSA attestation references the SBOM:
```sh
gh attestation verify oci://ghcr.io/kajlabs/lithosphere-api:v1.27.0 \
  --owner KaJLabs --predicate-type https://spdx.dev/Document
```

---

## Cross-references

- Signing/attestation **policy** and verification UX: `supply-chain.md`
- Release flow + version bumps: `release-process.md`
- Rotation of the keys behind the above (Cosign Fulcio, npm
  provenance, AWS OIDC): `key-rotation-runbook.md`
- License obligations on consumed packages: `license-policy.md`

---

## Open follow-ups (out of P3 closure scope)

- **Multi-arch image builds** (linux/arm64 alongside linux/amd64).
  Deferred — production EC2 is x86 and a 2× build-time cost has no
  current consumer. Revisit when Graviton becomes a target or Mac
  developer ergonomics demand it.
- **Image promotion to a second registry** (e.g., AWS ECR mirror).
  Deferred — GHCR availability hasn't been a reliability concern.
- **CycloneDX SBOM** alongside SPDX. Same content, different schema;
  ship if a downstream tool requires it.

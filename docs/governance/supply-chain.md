# Supply Chain Hardening

Every container image Lithosphere publishes to GHCR carries three
verifiable artifacts produced by `.github/workflows/publish-images.yaml`:

1. **Cosign signature** — keyless, identity-bound to the GitHub Actions
   workflow that built the image. Proves the image was produced by *this*
   repository, not a typo-squatter.
2. **SLSA build-provenance attestation** — in-toto SLSA Provenance v1.0
   statement linking the image digest to the specific workflow run, source
   commit, and build invocation. Proves *how* the image was produced.
3. **SBOM (SPDX)** — Software Bill of Materials enumerating every package
   in the image. Required for CVE response and license-policy audits.

Together they satisfy SLSA Build Level 2 (signed provenance from a hosted
build platform). Level 3 (non-falsifiable provenance) would require a
hardened isolation layer beyond GitHub-hosted runners — out of scope for
testnet posture.

## Verifying a published image

Pick any tag on any image at `ghcr.io/kajlabs/lithosphere-*`. Three checks,
in order of increasing strength:

### 1. Cosign signature

```bash
cosign verify ghcr.io/kajlabs/lithosphere-api:sha-<short> \
  --certificate-identity-regexp 'https://github.com/KaJLabs/Lithosphere/.+' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

Success output includes the Fulcio cert subject (workflow ref + actor +
SHA) and the Rekor transparency log entry. A mismatch means either the
image wasn't built by this repo, or the workflow was tampered with.

### 2. SLSA build provenance

```bash
gh attestation verify oci://ghcr.io/kajlabs/lithosphere-api:sha-<short> \
  --owner KaJLabs
```

This validates the in-toto attestation pushed to the registry alongside
the image. The output includes the build parameters, source repo +
commit, and runner platform. Stricter than the Cosign check because the
attestation includes a structured description of how the build happened,
not just "this org signed it."

### 3. SBOM

```bash
gh run download <run-id> -n sbom-api -D ./sbom
cat sbom/sbom-api.spdx.json | jq '.packages | length'
```

SBOMs are uploaded as workflow artifacts (90-day retention). For CVE
response: `jq '.packages[] | select(.name == "<dep>")'` finds whether a
known-vulnerable package is in your image.

## What each verification rules out

| Threat | Cosign sig | SLSA provenance | SBOM |
|--------|:----------:|:---------------:|:----:|
| Typo-squatted image (`lithosphere-apl` instead of `-api`) | ✅ | ✅ | — |
| Image rebuilt offline + force-pushed to GHCR with a stolen token | ✅ | ✅ | — |
| Workflow modified to inject malicious code into the build | — | ✅ | — |
| Same Dockerfile, different source commit | — | ✅ | — |
| Same source commit, but pulled-in dep CVEd post-build | — | — | ✅ |

The three are complementary; a serious compliance review checks all three.

## How the gates layer

`publish-images.yaml` pipeline order:

```
checkout
  → buildx + metadata
    → build & push image
      → Trivy scan (HIGH/CRITICAL to SARIF, CRITICAL gate)
        → Cosign keyless sign
          → SLSA build-provenance attestation (push-to-registry)
            → SBOM (SPDX, uploaded as artifact)
```

Trivy runs *before* signing so a CVE-laden image never gets an attestation
in the first place. The CRITICAL gate is hard-fail; HIGH findings upload
to the GitHub Security tab for triage (see
[license policy](./license-policy.md) for the parallel dependency-side gate).

## Deployment-side verification (future)

Today `deploy-simple.yaml` builds from source on the bastion, so the
GHCR-side signatures/attestations aren't consulted during deploy. Future
work — likely once we move to a pull-the-published-image model — would
add a Cosign + attestation verification gate before the `docker compose
up`. The verification commands above are the ones to drop into that
gate.

## Rotation & key management

Cosign keyless avoids holding a long-lived signing key — every signature
is bound to a short-lived Fulcio certificate issued during the workflow
run. The trust anchor is the GitHub Actions OIDC issuer + the
`KaJLabs/Lithosphere` repo identity. No key to rotate, no key to leak.

For npm package publishes (SDK), the equivalent identity binding is npm
provenance attestations — wired in `release.yaml` via `--provenance`.
See [release-process.md](./release-process.md).

## Related

- [License Policy](./license-policy.md) — dependency-side supply chain
- [Key Rotation Runbook](./key-rotation-runbook.md) — for the cases where
  rotation IS required (RPC keys, deployer private keys, NPM_TOKEN)
- [Deployment Approvals](./deployment-approvals.md) — the human gate layered on top of the technical gates
- [Phase 10 work in the project memory tracker](../phases/README.md) — broader security posture

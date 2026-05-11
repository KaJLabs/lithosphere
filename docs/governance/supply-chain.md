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

## Code-level static analysis

Image-layer attestations and dependency-license enforcement don't catch
bugs in the source we own — SQL injection, SSRF, path traversal, weak
crypto, prototype pollution. That's what
[`codeql.yaml`](../../.github/workflows/codeql.yaml) covers: GitHub's
CodeQL runs on every push to `main`, every PR, and weekly via cron. The
JS/TS extractor (build-mode `none`, query suite `security-and-quality`)
indexes `Makalu/{api,indexer,explorer,packages,templates,contracts/scripts,tooling}`
plus repo-level `scripts/`. Findings post to the Security tab under
the `codeql-javascript-typescript` category, alongside Trivy's
`trivy-{api,indexer,explorer}` entries.

The three layers compose:

| Layer | Catches | Workflow |
|---|---|---|
| Source SAST | bugs in code we wrote | `codeql.yaml` |
| Container scan | OS/library CVEs | `publish-images.yaml` (Trivy) |
| Supply chain | image tampering / typo-squat | `publish-images.yaml` (Cosign + SLSA + SBOM) |

### Triage workflow for CodeQL findings

CodeQL's first-scan baseline often contains a long tail of style-level
notes plus a handful of legitimate-but-false-positive flow alerts (e.g.
`router.push(\`/blocks/\${userInput}\`)` flagged as DOM-XSS because the
extractor can't prove the destination route doesn't `innerHTML` the
segment). The expectation is **not** "zero open alerts" — it's "every
open alert has been triaged":

1. **Fix at source** when the alert points at a genuine issue. Recent
   examples (commit landing this section): `js/log-injection` from
   `console.warn` with raw user input → `sanitizeForLog()` helper that
   strips ASCII control chars; `js/file-system-race` from an
   `existsSync`→`appendFileSync` pair → drop the pre-check (the append
   creates on demand); `js/polynomial-redos` on `/=+$/` → manual
   trailing-char strip with no regex.
2. **Dismiss with a comment** when the alert is a false positive. Use
   the GitHub Security UI ("Dismiss alert" → "False positive" / "Used
   in tests" / "Won't fix") and include the reason. Don't leave open
   alerts indefinitely without dismissal — they create noise that
   masks real findings.
3. **Track as work** when the alert is real but the fix needs design
   (e.g. SSRF in a controlled-base proxy endpoint — needs an explicit
   URL allow-list). Create an issue, link the alert, leave the alert
   open until the issue closes.

Cadence: triage every Monday alongside the weekly CodeQL cron run.

## Related

- [License Policy](./license-policy.md) — dependency-side supply chain
- [Key Rotation Runbook](./key-rotation-runbook.md) — for the cases where
  rotation IS required (RPC keys, deployer private keys, NPM_TOKEN)
- [Deployment Approvals](./deployment-approvals.md) — the human gate layered on top of the technical gates
- [Phase 10 work in the project memory tracker](../phases/README.md) — broader security posture

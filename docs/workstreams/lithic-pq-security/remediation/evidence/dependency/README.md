# Dependency Security Evidence

**Baseline:** `LITHO-PQ-PHASE0-R1-20260825`
**Scan date:** 2026-08-26
**Status:** implementation blocker; design work may continue

The scan uses the patched Evmos v20/Cosmos SDK source assembly identified in
`SOURCE_AND_BUILD_BASELINE_2026-08-25.md`. The Windows local `replace` path was
normalized to the same Cosmos SDK source directory inside an isolated WSL copy;
module versions and source were not changed.

## Results

`govulncheck` v1.7.0 used the Go vulnerability database updated 2026-08-25 and
performed source/symbol reachability analysis across 149 root packages, 240
modules, and Go 1.23.12.

The scan did **not** clear the baseline. Mechanical classification of all 194
finding records in the retained JSON stream reports:

- symbol-reachable (trace contains a function): **0**;
- package-imported (package, no function): **93**;
- module-present (module, no package/function): **101**.

The earlier R2 statement that 48 findings were symbol-reachable was incorrect
and is superseded. Package/module presence is not proof that a vulnerable
symbol is called, but it also does not prove non-applicability. Fork deltas,
reflection, unsafe behavior, build tags, and runtime reachability still require
review before this baseline can be cleared.

The dependency graph resolves the effective geth replacement as
`github.com/evmos/go-ethereum v1.10.26-evmos-rc4`; the earlier appearance of
upstream `go-ethereum v1.11.5` in a raw graph is not the selected linked module.
This does not make the selected Evmos fork safe by assertion: its fork delta and
upstream advisory applicability still require explicit review.

## Gate

No consensus-enabled Makalu candidate may be built from this baseline. Before
implementation review, KaJ Labs must produce and test a compatible dependency
update/backport set, rerun unit/integration/consensus tests, regenerate the SBOM
and scan, and either eliminate every reachable finding or provide Autha-accepted
code-path/mitigation evidence for each exception.

Generated artifacts:

- `govulncheck-source.json` — machine-readable source reachability report;
- `govulncheck-classification.json` — mechanically derived trace-precision
  classification, with no manual severity inference;
- `bom.cdx.json` — CycloneDX 1.6 module SBOM generated from the selected
  require/replace graph in the retained assembled `go.mod`;
- `SCAN_COMMANDS.md` — exact reproducible commands and tool versions.

| SHA-256 | Artifact |
|---|---|
| `cef394005b69c650c8cc56e9323439f5ea2f5adbf810a65b635b941ca455c42b` | `govulncheck-source.json` |
| `016207567cba42ad034bbaab9e8ccc38a4f5880cf0cca9e825da39bb69e3114e` | `govulncheck-classification.json` |
| `4b92c57d7827c9ae6570eca69140d1119de7b84ded6e9106256958b0f5a4a393` | `bom.cdx.json` |

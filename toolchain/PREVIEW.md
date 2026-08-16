# Toolchain boundary preview

These archives are CI artifacts for evaluating the reviewed `0.0.1` command
boundaries. They are not a public toolchain release and are not deployable
compiler artifacts.

The archive contains all eight command names so packaging and platform startup
can be tested. Their current capabilities are:

- `lithc`: declaration parsing, conservative declaration-name checks, and
  summary/AST/ABI/check output; no function-body compilation or bytecode.
- `lithfmt`: parse-safe, literal-preserving whitespace normalization.
- `lithlint`: reviewed declaration-level L001-L004 rules.
- `lithdev`: bounded local Compose lifecycle, read-only checks/ABI output, and
  fail-closed deployment preflight; no signing or broadcast.
- `lithls`, `lithtest`, `lithsec`, and `lithpkg`: specification-only commands
  that explicitly refuse their unimplemented operational modes.

Each CI artifact includes a SHA-256 checksum and a generated `manifest.json`
with the source commit, platform, workspace version, and `release: false`.

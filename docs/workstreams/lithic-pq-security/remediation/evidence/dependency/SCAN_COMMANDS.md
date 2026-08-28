# Dependency Scan Commands

The exact source baseline is copied to an isolated temporary directory. Only the
host-specific local Cosmos SDK replacement path is translated from Windows to
the equivalent WSL path.

```bash
export PATH=/path/to/go1.23.12/bin:/path/to/tools:$PATH
govulncheck -mode source -format json ./... > govulncheck-source.json
python reference/summarize_govuln.py
node reference/generate_go_sbom.mjs
```

Tool identities used for the retained evidence:

- `govulncheck` v1.7.0;
- Go toolchain v1.23.12 selected by the module toolchain directive;
- local deterministic `litho-go-module-sbom-generator` v1.0.0, which converts
  the retained selected require/replace graph to CycloneDX 1.6.

The raw JSON artifacts are mechanically generated and must not be edited.

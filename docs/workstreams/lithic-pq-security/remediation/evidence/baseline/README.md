# Patched L1 Dependency Baseline Evidence

**Generated:** 2026-08-25
**KaJLabs baseline:** `41172e2d44b9f038b32633746ef6e8f1a90a3dfb`
**Evmos:** `eca13ef2521a9ef13c32e80b1b147230bdb155b5`
**Cosmos SDK:** `f2e6295b662fdb27ea33da1296c29588ccdaab42`

The exact KaJ compatibility, fixed-supply, and integration-test patches were applied to clean upstream clones. The same dependency edits as `build-lithod.sh` were then applied with an isolated official Go 1.23.12 toolchain. `go mod tidy` and `go mod verify` completed; the module graph was generated from the resulting files.

The long-running expanded `go list -m all` operation was not used as evidence. `assembled-go.mod`, `assembled-go.sum`, the complete 11,410-line graph, and the 2,382 sorted graph nodes form the reproducible dependency evidence for this design candidate. The later implementation candidate must repeat this process in the immutable release builder and also include the compiled binary/module/SBOM evidence.

| SHA-256 | File |
|---|---|
| `249489ca78fd37250c85eeac3bdc6a74dc0858732be7e1f2da1da2a67a61cf07` | `assembled-go.mod` |
| `cc1ec0d7ffb471d8ac327607a9067d565dd3a4fd42153f51c7eef3b40d335857` | `assembled-go.sum` |
| `9173044540758518a6e2604ea49512d487619483c608ffd4ce2ec65ce3c834c0` | `go-mod-graph.txt` |
| `8e1166691505a463cabaa85c2ecfd6dd06baa6add48fd77044026b552c1ac683` | `go-module-nodes.txt` |
| `96b2276118068f9dfa8db81558ae8da64b1279d8c3a9fe026e79fc315a000107` | `go-mod-verify.txt` |
| `96f1c5a9efe3e764ab883e3c965a8f0fd0a7d56ddb22ef17da9b2ce6393a0714` | `go-version.txt` |

Official Go archive used for the isolated toolchain:

`go1.23.12.windows-amd64.zip` SHA-256 `07c35866cdd864b81bb6f1cfbf25ac7f87ddc3a976ede1bf5112acbb12dfe6dc`.

# `lithpkg` implementation specification

Status: reviewed specification only. The `lithpkg` crate remains at `0.0.1` and
must not initialize packages, resolve dependencies, write lockfiles, fetch code,
or claim reproducibility. This matches the original toolchain target, which lists
the package manager as specification-only in this scaffold.

## Required owner inputs

Implementation is blocked until the Lithic/compiler, release, and security owners
approve:

- the manifest and lockfile names, grammars, schemas, and versioning rules;
- package/module naming, source layout, import resolution, features, targets, and
  compiler include/module integration;
- the exact version and version-requirement standard;
- resolver behavior for transitive dependencies, duplicates, conflicts, cycles,
  optional dependencies, platform conditions, and prereleases;
- whether v0 is local-path-only or includes a registry, Git, archive, or other
  source types;
- registry ownership, authentication, authorization, namespace, immutability,
  signing, transparency, revocation, yanking, retention, and incident policy;
- the artifact digest/signature algorithms and canonical bytes they cover;
- offline, vendoring, cache, mirror, proxy, and reproducible-build behavior.

No TOML subset, semantic-version subset, default package version, registry, hash,
or trust policy may be inferred without those approvals.

## Minimum implementation boundary

A future implementation may be called a package manager only when it:

1. parses the approved manifest/lock schemas with a conforming parser and rejects
   unknown, duplicate, malformed, or unsupported fields deterministically;
2. performs complete deterministic dependency resolution, including transitive
   graphs, conflicts, cycles, aliases, and source identity;
3. canonicalizes and constrains local paths, handles symlinks explicitly, and
   prevents unintended traversal outside the approved package/workspace boundary;
4. uses an approved cryptographic digest and, where required, verifies publisher
   identity, signatures, provenance, and immutable source content;
5. writes manifests, source scaffolds, caches, and lockfiles atomically without
   overwriting existing user files or leaving partial packages;
6. records enough canonical source, version, digest, feature, target, and resolver
   metadata for reproducible offline builds;
7. feeds only locked, verified module roots into the approved compiler import
   resolver and detects package/module name collisions;
8. separates read-only check/resolve operations from mutating init/fetch/update
   operations and supports dry-run output for every mutation;
9. fails closed on unsupported schema, source, signature, digest, compiler, or
   lockfile versions.

## Required verification

- Manifest and lockfile conformance fixtures, including comments, escapes,
  Unicode, duplicates, unknown fields, malformed values, and schema upgrades.
- Resolver fixtures for diamond graphs, conflicts, cycles, aliases, prereleases,
  optional/platform dependencies, source changes, and deterministic ordering.
- Filesystem fixtures for absolute/relative paths, `..`, symlinks, junctions,
  case sensitivity, non-UTF-8 names where supported, and workspace escape attempts.
- Integrity fixtures for tampering, digest/signature mismatch, revocation, yanking,
  offline cache use, and source identity substitution.
- Crash/interruption and atomicity tests proving existing files are preserved and
  partial state is recoverable.
- Repeated clean/offline builds producing identical locks and compiler inputs on
  Linux, Windows, and macOS.
- Independent compiler, supply-chain security, and release-owner acceptance.

## Rejected draft boundary

The local uncommitted draft reviewed on 2026-08-16 is not acceptable for release.
It promotes the crate to `0.1.0`, hand-parses a TOML-like subset, treats three
numeric components as complete semantic-version validation, resolves only direct
local paths, lacks graph/cycle/path/symlink controls, and labels a 64-bit FNV-1a
value as a package checksum. Its init and lock operations write non-atomically and
are not integrated with an approved compiler import resolver. None of that draft
is included in this slice.

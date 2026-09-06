# Autha LITHO L1 M03 R4 remediation record

This release-control-only remediation changes no L1 executable and authorizes
no restart, deployment, transaction, Kamet rollout, or mainnet rollout.

## Inputs reconciled

- R3 final disposition review SHA-256:
  `5717d20606c33f6a65fab31616ce2f0662f122dfd5175a8519b549b0e7584098`
- R3 final re-review SHA-256:
  `1fdd18a765faa28251729162814910e98be15bb16864f82f6646e5443e6db611`

The reports differ in severity and requested closure path. This remediation
uses their union and does not treat either report as M03 closure.

## Completed controls

1. Manual inputs are passed through environment variables and a dedicated
   validator; no dispatch string is interpolated into shell source.
2. Hostile quotes, separators, substitutions, newlines, traversal, globs, and
   shell metacharacters are covered by regression tests.
3. Third-party workflow actions are pinned to immutable commit SHAs.
4. The approval verifier enforces the immutable release tag, canonical target
   chain IDs, reviewed validator allowlist, and non-bypassable pause policy.
5. Autha and KaJ approval artifacts must be structured JSON whose semantics
   match the bundle. Their hashes and the entire bundle are authenticated by a
   detached signature from the pinned KaJ Labs organizational release key.
6. All three activation environments require `@lithoagent` or `@Jkasr`,
   prevent self-review, restrict deployment to protected branches, and disable
   administrator bypass.
7. The earlier attestation and exception record now accurately disclose the
   missing historical raw state and case-2 gas limitation.
8. The original M03 text, correct earlier review digest, and accurate earlier
   disposition characterization are retained in the exception record.

## External evidence still required

1. A person other than execution operator BrewCodeDev must complete the
   independent-observer attestation.
2. Case 2 requires either a supported trace/revert reason or a separately
   pre-approved Makalu re-run at a materially higher gas limit. Public
   `debug_traceTransaction` is unavailable and historical application state is
   pruned, so no read-only reconstruction is claimed.
3. After merge, rebuild and sign the R4 evidence payload and request Autha's
   focused final disposition.

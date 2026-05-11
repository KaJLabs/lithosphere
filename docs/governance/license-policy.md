# License Policy

Lithosphere ships open-source code and a TypeScript SDK to npm. To keep the
distributed binaries and the `@lithosphere/*` packages free of copyleft or
source-disclosure obligations, every dependency's license is checked on
every push to `main` and every pull request.

The policy lives at [`.license-policy.yaml`](../../.license-policy.yaml).
The CI gate is the `license-check` job in
[`.github/workflows/ci.yaml`](../../.github/workflows/ci.yaml). The script
that runs the check is [`scripts/check-licenses.mjs`](../../scripts/check-licenses.mjs).

## What's allowed

Permissive licenses that impose at most an attribution requirement and no
redistribution restrictions. Current allow-list:

| SPDX ID         | Notes |
|-----------------|-------|
| `MIT`           | The most common JS-ecosystem license. |
| `ISC`           | Functionally equivalent to MIT. |
| `Apache-2.0`    | Patent-grant clause; explicit but compatible. |
| `BSD-2-Clause`  | Minimal attribution-only BSD variant. |
| `BSD-3-Clause`  | Adds non-endorsement clause; still permissive. |
| `0BSD`          | Zero-clause BSD — effectively public domain. |
| `BlueOak-1.0.0` | Modern permissive; used by node-glob ecosystem. |
| `CC0-1.0`       | Public domain dedication. |
| `Unlicense`     | Public domain dedication. |
| `WTFPL`         | Permissive; functionally equivalent to public domain. |
| `Python-2.0`    | Historic permissive used by some build tooling. |

Compound SPDX expressions (`(MIT AND BSD-3-Clause)`, `(MIT OR CC0-1.0)`)
are decomposed automatically: AND-compounds require every part to be
allowed; OR-compounds require at least one.

## What's explicitly blocked

Strong copyleft, source-available, and commercial-restricted licenses.
Direct matches in this list fail CI with no exception path:

`GPL-2.0`, `GPL-3.0`, `GPL-*-or-later`, `AGPL-1.0`, `AGPL-3.0`,
`AGPL-3.0-or-later`, `LGPL-2.0`, `LGPL-2.1`, `LGPL-3.0`, `SSPL-1.0`,
`BUSL-1.1`, `Elastic-2.0`, `Commons-Clause`.

## Exceptions

A package with a license that's not in the allow-list can be approved via a
per-package exception. As of 2026-05-11, the only granted exception is:

| Package        | License    | Reason |
|----------------|------------|--------|
| `caniuse-lite` | `CC-BY-4.0` | Browser-compatibility data tables. CC-BY-4.0 imposes only an attribution requirement on derivative *data* works; we redistribute it embedded in build tooling, not as a primary product. |

## How to add a new package whose license isn't allowed

The CI failure log lists the offending package and license:

```
[needs-review] some-pkg@1.2.3
   license: SomethingNonStandard
   reason:  license 'SomethingNonStandard' not in allow-list; no exception entry for some-pkg
```

Three legitimate responses:

1. **Swap the dependency** for an alternative with an allowable license.
   Often the cheapest option for utility packages.
2. **File an exception** if the package is truly required and a human review
   concludes the license is acceptable for Lithosphere's use case. Edit
   `.license-policy.yaml`:
   ```yaml
   exceptions:
     - package: some-pkg
       license: SomethingNonStandard
       reason: |
         Why this is OK for our use case — link to the license text,
         summarise the obligations, note the maintainer who reviewed.
   ```
   Re-run `node scripts/check-licenses.mjs` locally to confirm.
3. **Promote the license to globally allowed** if it's broadly compatible
   and likely to recur. Add it to `allow:` in `.license-policy.yaml` with
   a comment explaining the rationale.

## Running locally

```bash
node scripts/check-licenses.mjs
```

The script:
- reads `.license-policy.yaml`
- spawns `pnpm licenses list --recursive --prod --json` in `Makalu/`
- evaluates every (package, license) pair against the policy
- prints a per-violation table on failure, or "License check passed." on success

No npm install needed beyond what the workspace already requires.

## Why this matters

A single GPL-licensed dep pulled in transitively can:
- contaminate Lithosphere's redistribution rights
- block the SDK from being shipped to npm under its current license
- force open-sourcing of unrelated proprietary work elsewhere in the org

This gate is cheap to run (one shell-out, ~1.5s in CI) and catches the risk
at PR time when it costs nothing to swap the dependency. Once it ships to a
release, removal is much harder.

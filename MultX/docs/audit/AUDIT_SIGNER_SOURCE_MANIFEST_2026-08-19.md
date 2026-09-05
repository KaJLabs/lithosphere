# MultX signer audit source manifest - 2026-08-19

> **Historical v0.6 evidence only.** Regenerate a complete source manifest from
> the immutable v0.8 tag before handing the remediation back to Autha.
> The KMS/AWS signer described below was rejected and removed from the active
> runtime. Do not use this manifest as current implementation guidance; use
> `AUDIT_SIGNER_SOURCE_MANIFEST_2026-09-05.md` for the non-AWS candidate.

Status: audit input only. MultX and release signing remain disabled.

The Solidity audit candidate remains the immutable tag
`multx-audit-candidate-v0.6.0-20260819`. The separately quoted off-chain signer
protocol review must use the following public repository commit:

`2e137040440d333ee586aba527c4fb7172a34e21`

The commit is immutable. If any in-scope signer source changes during
remediation, publish a new manifest and candidate reference; never silently
substitute files.

## Production signer source boundary

| File | Physical lines | SHA-256 |
| --- | ---: | --- |
| `MultX/signer/Dockerfile.fargate` | 16 | `3335dcc69a2470d7eb7199cdd2850e737763583df7ee9b3af0dc27bcaae85419` |
| `MultX/signer/package.json` | 15 | `263f89dddc981f0da72aad4880f807205a0c558a627f9fcf46531d429ad87ead` |
| `MultX/signer/package-lock.json` | 562 | `43b8a19c062ed2bd79cfa8f707aba983b492dee7f8d891c249b7a3602f28f22d` |
| `MultX/signer/src/auth.js` | 27 | `89af267afe6ba7a08a3bf344b5314a9cea910ec66cc433e20ca8452a32cb97fb` |
| `MultX/signer/src/dynamoJournal.js` | 53 | `66131ac624b458275aa5d0c436da58fc9f8794d8684efee554c122c59ec8a436` |
| `MultX/signer/src/index.js` | 207 | `ca8223e2cc9ea8276af05e7be198e5c9e9e9f117ab94151cd57ea17f7826f393` |
| `MultX/signer/src/journal.js` | 50 | `139c8bbe5d047c10ad87498cf5c894fd1ee26fc852f228afc6b65cc772a744b2` |
| `MultX/signer/src/kmsSigner.js` | 86 | `ebabf5b9fcc20b11a65316d1822fe9077eccaddf3227ef441074eb6223e9aa87` |
| `MultX/signer/src/policy.js` | 150 | `2a2a82a01eba1ce1245fbe0850c27a3b1236bb21bd22cd4e1e3875ecc98e0a4e` |
| `MultX/signer/src/runtimeConfig.js` | 27 | `2d9c8807f175f1a2e449078c9a6a79d5d2bc5b3b6e5e8106743f2e8af34780e2` |
| `MultX/signer/src/signingKey.js` | 38 | `06c7d315b08b56f86b2a6fa7435f4070b90270ed15be8ebb06db1b36a8b3769b` |
| `MultX/api/src/services/remoteSigner.js` | 184 | `c9cb5d86db1e8a98e2012aa53f03142b8f6bceb93ad95a0ca4fb81c65ebae47d` |
| `MultX/api/src/services/validatorService.js` | 216 | `e996953b630addd2594b7a5219a50534a1ebbaa7fd4e404c0f06e8d4cc9f94fc` |
| `MultX/api/test/remoteSigner.test.js` | 105 | `ffe647bdddbdf7965ca3bc725df7a6f460e4ced13fbcaf7a670fc0b2a00cbc22` |

The firm should also run every test under `MultX/signer/test/` at the recorded
commit. Production AWS resource identifiers, bearer-token values, private
network inventory and monitoring destinations remain in the private
infrastructure repository and are not required for source review.

## Reproducible verification

From a clean checkout of the recorded commit:

```bash
git rev-parse HEAD
cd MultX/signer
npm ci
npm test
```

Recalculate a file hash with `sha256sum <path>` (Linux/macOS) or
`Get-FileHash -Algorithm SHA256 <path>` (PowerShell) and compare it with this
manifest. Any mismatch stops the audit handoff.

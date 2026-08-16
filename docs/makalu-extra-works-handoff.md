# Makalu extra works — living handoff

- **Status:** Active — closing one stream at a time
- **Last verified:** 2026-08-15 00:04 PKT (UTC+05:00)
- **Repository:** `KaJLabs/Lithosphere`
- **Default branch inspected:** `origin/main` at `5570c959c4dc746a5fdae28c859318d963b0a7ae`
- **Latest merged workstream change:** PR #75 at `5570c959c4dc746a5fdae28c859318d963b0a7ae`
- **Network in scope:** Makalu testnet, EVM chain ID `700777`, Cosmos chain ID `lithosphere_700777-2`

This is the source of truth for the seven Makalu extra-work streams. Update it whenever code is merged, a release is
published, a live probe changes, an external dependency is received, or an acceptance check is completed. The older
[dependency requests](makalu-extra-works-dependency-requests.md) remain useful as forwardable team requests, while
[mainnet readiness](mainnet-readiness-2026-07-22.md) preserves the broader launch assessment.

## How to read and update this handoff

A stream is not complete merely because its code exists in the working directory.

| Gate | Meaning | Evidence required |
| --- | --- | --- |
| Local | Implementation exists in a developer workspace. | Paths and local verification results. |
| Merged | Reviewed work is tracked on the default branch. | PR or commit reference and required CI results. |
| Released | Immutable, verifiable artifacts were published. | Release URL, version, checksums/signatures, and CI run. |
| Deployed | The intended environment runs the released artifact/configuration. | Deployment record plus live probes. |
| Accepted | Owners and dependent teams completed the stream's acceptance checklist. | Named approver, date, and linked evidence. |

Use these status values:

- `COMPLETE` — every acceptance item is checked and evidence is linked.
- `IN PROGRESS` — safe repository or environment work remains possible.
- `EXTERNAL BLOCKER` — the next required input or authority is held outside this repository.
- `LOCAL ONLY` — material work exists but is not yet merged into `main`.

When changing a status, update the summary, the stream checklist, the verification ledger, and the change log in the
same commit. Never include wallet keys, API keys, validator snapshots, private inventory, or other secrets here.

## Executive snapshot

No stream is marked complete unless every acceptance criterion has evidence. The Lithoscan mainnet cutover is
complete, but it is not one of these seven Makalu extra-work closures. The longest remaining engineering track is
the compiler/toolchain; the highest-priority operational gap is the encrypted validator backup.

The worktree is shared and contains pre-existing changes across several streams. Preserve them, isolate each stream
into a reviewable change, and never bulk-commit the dirty worktree.

| ID | Workstream | Current gate | Status | Immediate next action |
| --- | --- | --- | --- | --- |
| MX-06 | Validator cleanup and safety | Chain monitor active; encrypted backup blocked | EXTERNAL BLOCKER | Assign custodians and add the public `BACKUP_RECIPIENT`, then run backup/restore verification. |
| MX-02 | LEP100 faucet assets | Safeguards and secured image pipeline merged; production release remains manual | EXTERNAL BLOCKER | Rotate the exposed faucet key, install the protected wrapper, fund assets, deploy, and prove live claims/alerts. |
| MX-03 | Thanos Wallet | Repository work merged and deployed; acceptance open | EXTERNAL BLOCKER | Wallet team completes the published-version browser matrix, signed transaction, and approval record. |
| MX-04 | DNNS | Verified explorer hardening merged and deployed; owner acceptance open | EXTERNAL BLOCKER | DNNS owner confirms the supported interface, fixes public docs, nominates a reverse record, and accepts cache policy. |
| MX-05 | Quantt | Assumption-free gates deployed; adapter remains disabled | EXTERNAL BLOCKER | Quantt owner supplies the API contract/credential and fixes or replaces the development TLS endpoint. |
| MX-01 | MultX / Lithoswap | V2 DEX and non-AWS signer hardening merged; swap disabled | IN PROGRESS | Obtain independent audit, operator, deployment, controller, and liquidity approvals. |
| MX-07 | Developer toolchain | Conservative compiler-front-end slice and three-OS CI merged; no deployable compiler/release | IN PROGRESS | Review each remaining tool separately; approved language/VM semantics still block full compiler work. |

## Sequential closure queue

Only one repository stream is active at a time. An external blocker is recorded and escalated, then work advances
to the next executable stream without pretending the blocked stream is complete.

1. [ ] **MX-06 Validator cleanup and safety** — waiting on responder/custodian governance and public backup recipient.
2. [ ] **MX-02 LEP100 faucet assets** — safeguards and image publishing merged; key rotation, VPS wrapper activation, funding, live claims, and alerts remain.
3. [ ] **MX-03 Thanos Wallet** — next after MX-02 repository work is verified.
4. [ ] **MX-04 DNNS** — deployed; waiting on DNNS-owner interface, documentation, reverse-record, and cache-policy acceptance.
5. [ ] **MX-05 Quantt** — deployed; waiting on Quantt API/TLS/product inputs and acceptance.
6. [ ] **MX-01 MultX / Lithoswap** — security, deployment, liquidity, and acceptance remain.
7. [ ] **MX-07 Developer toolchain** — separate major compiler/release program.

## MX-01 — MultX Swap / Lithoswap

**Owners:** Dev Infra + Backend/Bridge team + contract deploy authority + approved liquidity owner

**Current state:** The MultX bridge UI/API and consolidated MultX source are merged, and the live feature
configuration reports the bridge enabled. PR #75 added a fail-closed, manifest-driven paused v0.5 Kamet/Makalu
redeployment procedure and was review-hardened to enforce the exact approved UTC window before reading the key or
signing. It merged as `5570c959c4dc746a5fdae28c859318d963b0a7ae`; no deployment occurred. AWS KMS/IAM PR #78
was closed without merge because it conflicts with the confirmed no-AWS architecture; `main` retains the existing
provider-neutral VPS remote-signer/quorum implementation. PR #68 isolated,
review-hardened, and merged the same-chain Lithoswap V2 contracts, deployment/liquidity/E2E scripts, and tests as
`07b37969f00d97eaca17794c31a83546b60a1940`. The optional V2
subgraph remains local-only and is not required for on-chain quotes. PR #93 hardened the provider-neutral signer,
API quorum, and bridge validator-set invariants and merged as `60f3f7bb151e9e2be48632468212e602220f40f4`.
No deployment, key access, funding, or feature enablement occurred. The live configuration reports `swap: false`; `/swap` and
`/cross-swap` return HTTP 200 but render unavailable states.

Completed or evidenced:

- [x] MultX bridge UI and same-origin API proxy are present.
- [x] Makalu/Kamet bridge addresses and the LEP100 token map are encoded.
- [x] Lock, status/signature polling, history, and release/claim paths exist.
- [x] Local Lithoswap V2 factory/router/pair and deployment/liquidity/E2E scripts exist.
- [x] Nine contract tests pass, including four Lithoswap tests (2026-08-03).
- [x] Live config reports `bridge: true` (2026-08-03).
- [x] PR #75's paused v0.5 testnet redeployment procedure was updated to current `main`, review-hardened, passed all
      checks plus 84 local Hardhat tests, and merged without executing a deployment (2026-08-15).
- [x] PR #78 was reviewed and formally blocked from merge pending a provider-neutral, non-AWS signer architecture.
- [x] Live config was reverified as `bridge: true`, `swap: false`; both swap routes show unavailable (2026-08-15).
- [x] PR #68 was updated to current `main`; unsafe deployment defaults were removed and explicit chain, controller,
      bytecode, manifest, preflight, and value-moving confirmation gates were added (2026-08-16).
- [x] The reviewed DEX slice passed 28 full Hardhat tests, 23 focused DEX/configuration tests, nine E2E checks,
      strict TypeScript validation, and Slither with zero detectors (2026-08-16).
- [x] Conflicting July UI PR #69 was verified as superseded by the newer fail-closed implementation on `main` and
      closed without merge (2026-08-16).
- [x] PR #68 passed all repository checks and merged by `bachal-mb` as
      `07b37969f00d97eaca17794c31a83546b60a1940`; no deployment or funding occurred (2026-08-16).
- [x] AWS-specific PR #78 was reverified unchanged and closed as rejected architecture; no signer deployment or
      production configuration change occurred (2026-08-16).
- [x] Local provider-neutral signer review added strict policy/RPC validation, journal-before-sign semantics, unique
      quorum identities, serialized polling, configured-signer-only counts, and explicit multichain evidence gates.
- [x] Eleven signer tests, eighteen API tests, and eighty-eight bridge-contract tests pass; all three production
      dependency audits report zero vulnerabilities locally (2026-08-16).
- [x] PR #93 passed all repository checks and merged by `bachal-mb` as
      `60f3f7bb151e9e2be48632468212e602220f40f4`; no deployment or key access occurred (2026-08-16).

Remaining actions:

- [x] Isolate, review, and merge the V2 contracts, release-gated deployment/liquidity scripts, and tests in PR #68.
- [ ] Separately review the optional V2 subgraph only if analytics are required. It is not required for quotes or swaps.
- [x] Close PR #78's AWS-specific signer proposal; AWS KMS/IAM is not an accepted project dependency.
- [x] Merge the provider-neutral signer/API/bridge review hardening in PR #93.
- [ ] Complete independent and operator acceptance, including key custody, host hardening, monitoring, failure
      behavior, recovery, and rollback before deployment.
- [ ] Modernize or explicitly disposition the MultX deployment/test toolchain's transitive audit findings before
      using it as a long-lived privileged runner (full local audit: 3 critical, 14 high; production-only audit: 0).
- [ ] Obtain Backend/Bridge confirmation of the route contract, token map, relayer/claim behavior, and supported
      source/destination chains.
- [ ] Complete contract security review and record deployer, admin/ownership, pause, upgradeability, and emergency
      procedures.
- [ ] Deploy reviewed contracts to Makalu and record addresses, transaction hashes, bytecode hashes, and artifact
      version.
- [ ] Seed only approved bounded liquidity and record token sources and initial pool ratios.
- [ ] Set the released explorer's swap-router configuration and enable swap through the controlled promotion flow.
- [ ] Run small-value same-chain swaps in both directions, remove liquidity, and reconcile balances.
- [ ] Run cross-chain lock/release tests in every approved direction, including retry, failure, and reversibility.
- [ ] Obtain Backend/Bridge and contract-owner acceptance.

Acceptance criteria:

- [ ] `bridge: true` and `swap: true` are intentional and tied to a reviewed release.
- [ ] Same-chain quote, approval, swap, slippage rejection, and liquidity removal pass live.
- [ ] Cross-chain lock, signatures, release, duplicate-claim rejection, and history pass live.
- [ ] Contract addresses, liquidity bounds, rollback/disable procedure, and approvers are recorded.

Evidence:

- `Makalu/explorer/lib/bridge.ts`
- `Makalu/explorer/lib/crossSwap.ts`
- `Makalu/explorer/pages/bridge.tsx`
- `Makalu/explorer/pages/swap.tsx`
- `Makalu/explorer/pages/cross-swap.tsx`
- `Makalu/contracts/src/dex/`
- `Makalu/contracts/scripts/deploy-dex.ts`
- `Makalu/contracts/scripts/seed-dex-liquidity.ts`
- `Makalu/contracts/scripts/dex-e2e.ts`
- `docs/dex-team-request-lithoswap.md`
- `MultX/docs/V05_TESTNET_REDEPLOYMENT.md`
- `MultX/docs/VPS_SIGNER_ARCHITECTURE.md`
- `MultX/signer/OPERATOR_RUNBOOK.md`
- Review PR: `https://github.com/KaJLabs/Lithosphere/pull/75`
- Lithoswap V2 PR: `https://github.com/KaJLabs/Lithosphere/pull/68`
- Blocked AWS proposal: `https://github.com/KaJLabs/Lithosphere/pull/78`
- Provider-neutral signer hardening: `https://github.com/KaJLabs/Lithosphere/pull/93`
- Live probes: `https://makalu.litho.ai/api/config`, `https://makalu.litho.ai/swap`,
  `https://makalu.litho.ai/cross-swap`

## MX-02 — LEP100 Lithic-native assets on the faucet

**Owners:** Dev Infra + faucet deploy owner + token treasury/contract owners

**Current state:** The live faucet exposes native LITHO plus ten LEP100 assets. Native LITHO is funded. Every LEP100
asset is below its minimum ten-token claim: WLITHO, LITBTC, JOT, COLLE, and FGPT have zero; LAX, IMAGE, AGII, BLDR,
and MUSA have five. Balance-aware, fail-closed API and explorer behavior passed seven focused tests plus a strict
TypeScript build. PR #80 merged those safeguards on 2026-08-14. PR #82 then merged secured faucet image publishing,
pre-publication vulnerability gating, immutable image waiting, and source-controlled deploy/rollback candidates as
`f6303f9d39f3c8075284dc73ecb65d4b3556e7eb`. The merged faucet image passed Trivy,
signing, provenance, and SBOM generation at digest
`sha256:34391877a9029461dfc261ce1ed0704b791d19f9065c0367a297952e49be12d8`. Production was intentionally not
deployed: faucet releases are manual pending rotation of the exposed funding key and protected-wrapper activation.
Treasury replenishment is also required before live token claims can pass.

Completed or evidenced:

- [x] Ten LEP100 assets and their Makalu contract addresses are configured.
- [x] The live faucet reports asset balances.
- [x] FGPT/MUSA metadata was corrected against the on-chain contracts.
- [x] Faucet TypeScript build passed on 2026-08-03.
- [x] Health metadata derives per-asset availability, claimable amounts, minimum claim, and exact shortfall locally.
- [x] Drip rejects underfunded assets before cooldown mutation or transfer, including a fail-closed balance-read path.
- [x] Explorer disables unavailable assets and presents their funding shortfall locally.
- [x] Seven focused availability/route tests and the strict faucet build pass (2026-08-14).
- [x] Faucet image passes the pre-publication CRITICAL Trivy gate and is signed, provenance-attested, and accompanied
      by an SBOM (2026-08-14).

Remaining actions:

- [x] Isolate, review, and merge `availability.ts` plus the drip/health/UI behavior in PR #80 (2026-08-14).
- [x] Add focused tests for zero balance, below-minimum balance, balance-read failure, malformed balance, and a
      successful funded claim path.
- [x] Extend the immutable GHCR publisher to build/sign/attest `lithosphere-faucet` on faucet changes (PR #82).
- [ ] Rotate the exposed faucet funding key through the server secret-management path before deployment; do not
      transmit the replacement key through chat or repository files.
- [ ] Have the VPS owner update the restricted deploy and rollback wrappers to recreate/restore the faucet container.
- [ ] Add and activate a separate manual faucet release workflow with immutable image, schema, and rollback gates
      after the funding key is rotated and the dedicated restricted wrappers are installed.
- [ ] Deploy the faucet/API/explorer release and verify unavailable assets are clearly disabled.
- [ ] Obtain approved replenishment amounts and fund every token above its operational reserve threshold.
- [ ] Execute one live claim for every asset and retain transaction hashes.
- [ ] Confirm low-balance alerts fire before an asset falls below its minimum claim.

Acceptance criteria:

- [ ] Health and claim endpoints fail closed per asset without presenting the whole faucet as healthy when claims
      cannot be served.
- [ ] All ten assets have an approved reserve and can satisfy at least one minimum claim.
- [ ] A successful live claim and post-claim balance are recorded for every asset.
- [ ] Alert routing and the replenishment owner are documented.

Evidence:

- `Makalu/faucet/src/services/availability.ts`
- `Makalu/faucet/src/services/availability.test.ts`
- `Makalu/faucet/src/services/wallet.ts`
- `Makalu/faucet/src/routes/drip.ts`
- `Makalu/faucet/src/routes/drip.test.ts`
- `Makalu/faucet/src/routes/health.ts`
- `docs/FAUCET_SETUP_INSTRUCTIONS.md`
- Live probe: `https://makalu.litho.ai/api/faucet/info`
- Isolated implementation commit: `c83910f`
- Review PR: `https://github.com/KaJLabs/Lithosphere/pull/80`
- Merge commit: `ef5092812cddc591836657cea6197f8aa2f46fac`
- Image/deployment pipeline PR: `https://github.com/KaJLabs/Lithosphere/pull/82`
- Pipeline merge commit: `f6303f9d39f3c8075284dc73ecb65d4b3556e7eb`
- Merged image run: `https://github.com/KaJLabs/Lithosphere/actions/runs/31814888627`
- Verified faucet image digest: `sha256:34391877a9029461dfc261ce1ed0704b791d19f9065c0367a297952e49be12d8`
- Live post-merge probe at 2026-08-14 15:24 PKT: previous payload still active (`ready` and per-asset `available`
  absent).

## MX-03 — Thanos Wallet integration

**Owners:** Dev Infra + Thanos Wallet team

**Current state:** Thanos is integrated as the EIP-6963 injected provider `fi.thanos.wallet`, with the extension's
official `window.thanos` surface as a fallback. Direct discovery, network addition/switching, SIWE message signing,
signature normalization, nonce verification, replay protection, bearer sessions, and disconnect behavior are
implemented. PR #83 merged the discovery hardening and acceptance record as
`6ded419ca7034f9ded110255dd1a2683d3399029`. The published Chrome version and production secret gate are verified.
Its first deployment was rolled back safely because the core explorer health gate incorrectly required the paused
MX-02 faucet schema. PR #84 isolated the core deployment, and run `31822244365` attempt 2 deployed release
`4fdb3ca5a4bcb0d24978189ce158028ae6247984` successfully without touching the faucet. Only wallet-team browser
acceptance and a low-value signed transaction remain open.

Completed or evidenced:

- [x] Thanos EIP-6963 discovery and prioritization are merged.
- [x] Direct “Sign in with Thanos” flow and install fallback are merged.
- [x] Makalu chain enforcement and add/switch-network flow exist.
- [x] Server-validated nonce/SIWE/session flow with replay protection exists.
- [x] API auth tests and explorer wallet/auth tests pass (2026-08-03).
- [x] Published Chrome version `0.9.33` was verified on 2026-08-14; its source commit `c352a5cfef22` announces
      EIP-6963 with RDNS `fi.thanos.wallet`, exposes `window.thanos`, and supports EIP-1193 signing.
- [x] The production Makalu API uses a present, non-placeholder `AUTH_SESSION_SECRET` of at least 32 characters;
      the value was not exposed (2026-08-14).
- [x] Automated coverage includes late EIP-6963 announcement and the official `window.thanos` fallback.
- [x] PR #83 passed all 15 required/reporting checks and merged as `6ded419ca7034f9ded110255dd1a2683d3399029`.
- [x] PR #84 isolated core deployment from the faucet; run `31822244365` attempt 2 passed the public gate and deployed
      release `4fdb3ca5a4bcb0d24978189ce158028ae6247984` (2026-08-14).

Remaining actions:

- [ ] Wallet team tests published extension version `0.9.33` in Chrome/Chromium and records browser/version evidence.
- [ ] Test fresh install, late EIP-6963 announcement, user rejection, wrong chain, network switch, reconnect, sign-out,
      extension restart, and browser restart.
- [ ] Submit an approved low-value signed transaction and verify it in Lithoscan.
- [ ] Obtain Wallet team acceptance.

Acceptance criteria:

- [ ] Thanos connects without falling back to another injected wallet.
- [ ] SIWE succeeds, replay is rejected, and the session survives an API restart.
- [ ] Makalu add/switch and one signed transaction succeed on the supported extension release.
- [ ] Wallet team approver, extension version, test date, and evidence are recorded.

Evidence:

- `Makalu/explorer/lib/thanos.ts`
- `Makalu/explorer/components/ThanosSignIn.tsx`
- `Makalu/explorer/context/WalletContext.tsx`
- `Makalu/api/src/__tests__/thanos-auth.test.ts`
- `Makalu/explorer/test/auth.test.ts`
- `Makalu/explorer/test/walletNetwork.test.ts`
- `docs/thanos-wallet-acceptance.md`
- `https://github.com/KaJLabs/Lithosphere/pull/83`
- `https://github.com/KaJLabs/Lithosphere/pull/84`
- `https://github.com/KaJLabs/Lithosphere/actions/runs/31819790372`
- `https://github.com/KaJLabs/Lithosphere/actions/runs/31822244365`

## MX-04 — DNNS integration

**Owners:** Dev Infra + DNNS team

**Current state:** Forward `.litho` search and reverse address display are merged and deployed. Direct source and
on-chain verification identified the supported deployed v0 as a Kamet-only (`900523`) registry at
`0x316dc15bF377F7187e5BE38BA19e673Ca823d1ab` through `https://rpc-3.litho.ai`. All nine reserved names resolve to
the deployment address. PR #86 merged and deployed hardening that removes process-lifetime negative caching,
separates an RPC failure
from a missing record, enforces the deployed 2LD normalization rules, and forward-verifies reverse names before
display. Protected run `31826844798` passed the deployment and public health gates for release
`c5448da8c617cf06083f9c08be7e08bd1b5cb6b2`. The public documentation describes a different Makalu-oriented
reference architecture without deployed addresses, and the deployed v0 currently has no reverse record for the
shared reserved-name address. All executable repository work is complete; the stream is now externally blocked.

Completed or evidenced:

- [x] Namehash, `.litho` detection, forward resolution, and reverse resolution exist.
- [x] Explorer search navigates resolved names to address pages.
- [x] Address pages can display reverse-resolved names.
- [x] Five DNNS tests pass (2026-08-03).
- [x] Deployment metadata and contract bytecode were independently verified against Kamet chain ID `900523`.
- [x] All nine source-controlled reserved names resolve live to
      `0xE9267bDf7084815B0754545049AE45FE744Aefa8` (2026-08-14).
- [x] Deployed label rules were traced to the names portal and encoded in explorer normalization tests.
- [x] Process-lifetime positive/negative caching was removed so new records can appear without a process restart.
- [x] RPC failures are distinguished from unset records, and reverse results require forward verification.
- [x] PR #86 passed all checks and merged as `c5448da8c617cf06083f9c08be7e08bd1b5cb6b2` (2026-08-14).
- [x] Protected deployment run `31826844798` passed image, deploy, and public health gates (2026-08-14).
- [x] Public release SHA, home, blocks, shipped validation text, and two live forward records were reverified after
      deployment.

Remaining actions:

- [ ] DNNS owner confirms the verified Kamet v0 deployment remains the supported explorer interface or provides a
      reviewed replacement deployment and migration date.
- [ ] DNNS owner updates public documentation with authoritative network IDs, contract addresses, normalization,
      and reverse-record rules; current public reference material conflicts with deployed v0.
- [ ] DNNS owner configures or nominates one stable reverse record and supplies its expected address/name pair.
- [ ] Agree on the no-persistent-cache policy or provide bounded positive/negative TTL requirements.
- [ ] Smoke-test forward, reverse, missing/malformed names, and RPC failure from the newly deployed explorer release.
- [ ] Obtain DNNS-team acceptance.

Acceptance criteria:

- [ ] Two known names resolve forward to their expected checksum addresses in the live explorer.
- [ ] At least one expected reverse record renders on a live address page.
- [ ] Missing names, resolver failures, normalization, and cache refresh behavior are documented and tested.
- [ ] DNNS approver, date, and evidence are recorded.

Evidence:

- `Makalu/explorer/lib/dnns.ts`
- `Makalu/explorer/components/DnnsName.tsx`
- `Makalu/explorer/components/SearchBar.tsx`
- `Makalu/explorer/test/dnns.test.tsx`
- `Makalu/explorer/test/dnns-resolver.test.ts`
- `docs/dnns-acceptance.md`
- Public DNNS documentation: `https://dnns.litho.ai/`
- Review PR: `https://github.com/KaJLabs/Lithosphere/pull/86`
- Deployment run: `https://github.com/KaJLabs/Lithosphere/actions/runs/31826844798`

## MX-05 — Quantt integration

**Owners:** Dev Infra + Quantt team + product owner

**Current state:** The credentials-safe server proxy, explorer page, provisional normalizer, tests, and OpenAPI paths
are deployed. The live status endpoint reports `configured: false`. The research site returns HTTP 200.
`dev.quantt.at` resolves to `91.236.195.168`, but presents a certificate for `quantts.ai` names and fails hostname
verification. The similarly named `dev.quantts.ai` is reachable, but is not an approved substitute. Repository
hardening removed guessed auth/path defaults and added the previously missing acceptance runbook. The adapter
must remain fail-closed until the exact owner-approved contract and secret-manager credential are available. PR #88
merged and protected run `31828985116` deployed the assumption-free gates as release
`c01ec48472544270ec0716483e5a07bba947b079`; all executable work is now externally blocked.

Completed or evidenced:

- [x] HTTPS and `quantt.at` hostname allow-listing exist.
- [x] Server-only authentication, symbol validation, bounded timeouts, and sanitized upstream errors exist.
- [x] `/api/quantt/status`, `/api/quantt/insights`, `/quantt`, tests, and OpenAPI documentation exist.
- [x] Live `/api/quantt/status` returns HTTP 200 and safely reports unconfigured (2026-08-03).
- [x] Live status, research portal, developer DNS, and the mismatched certificate subject/SANs were reverified on
      2026-08-14 without bypassing TLS for acceptance.
- [x] The unapproved `quantts.ai` lookalike was recorded but not substituted for the requested domain.
- [x] Activation now requires an explicit auth scheme and insights path instead of guessed defaults locally.
- [x] Five focused Quantt tests, all 164 API tests, and the strict TypeScript build pass locally (2026-08-14).
- [x] PR #88 passed all checks and merged as `c01ec48472544270ec0716483e5a07bba947b079` (2026-08-14).
- [x] Protected deployment run `31828985116` passed image, deploy, and public health gates (2026-08-14).
- [x] Public release SHA, disabled status, null API origin, page HTTP 200, and insights HTTP 503 were reverified after
      deployment.

External inputs required:

- [ ] Production and development API base URLs.
- [ ] Authentication scheme and a secret-store-delivered credential.
- [ ] Approved endpoint paths, request parameters, and versioned response schemas.
- [ ] Product decision on which analytics/research data is displayed.
- [ ] Rate limits, cache/redistribution policy, attribution, and retention guidance.
- [ ] Correct TLS certificate for `dev.quantt.at` or a replacement supported hostname.

Remaining actions after inputs arrive:

- [ ] Add schema validation and contract fixtures for approved responses.
- [ ] Configure secrets in staging without placing keys in client bundles, files, or logs.
- [ ] Validate reference symbols, empty results, rate limits, timeouts, and upstream failures.
- [ ] Promote configuration to Makalu and monitor error/cache behavior.
- [ ] Obtain Quantt and product-owner acceptance.

Acceptance criteria:

- [ ] Live status reports configured without exposing secrets.
- [ ] Approved reference responses render correctly and malformed responses fail closed.
- [ ] TLS, authentication, rate limiting, caching, retention, and attribution meet the Quantt contract.
- [ ] Quantt and product approvers, schema/version, date, and evidence are recorded.

Evidence:

- `Makalu/api/src/quantt.ts`
- `Makalu/api/src/__tests__/quantt.test.ts`
- `Makalu/explorer/lib/quantt.ts`
- `Makalu/explorer/pages/quantt.tsx`
- `docs/integrations/quantt.md`
- Live probe: `https://makalu.litho.ai/api/quantt/status`
- Public sites: `https://research.quantt.at/`, `https://dev.quantt.at/`
- Review PR: `https://github.com/KaJLabs/Lithosphere/pull/88`
- Deployment run: `https://github.com/KaJLabs/Lithosphere/actions/runs/31828985116`

## MX-06 — Validator infrastructure cleanup

**Owners:** Validator Infra team + Chain team + CAB/change approver; Dev Infra owns the audit helper

**Current state:** The audit helper and rolling-cleanup material still require the authoritative private inventory and
an approved cleanup window. Separately, the mainnet safety foundation has advanced: restricted `lithomonitor` access
is installed on the validator and both sentries, pinned host fingerprints were confirmed, PR #73 placed the protected
monitor and backup workflows on `main`, and scheduled chain progression checks are passing. Restricted `lithobackup`
access is installed on the validator, but every scheduled encrypted backup currently fails closed because the public
`BACKUP_RECIPIENT` environment value has not been configured.

Completed or evidenced:

- [x] Local audit helper compares rendered intent with fetched live snapshots.
- [x] Policy requires `consensus.timeout_commit = "500ms"`.
- [x] Policy rejects CometBFT RPC bound to `0.0.0.0`.
- [x] Auditor self-test passes (2026-08-03).
- [x] Safe one-sentry-at-a-time runbook exists.
- [x] Dedicated forced-command monitoring key installed on all three consensus nodes (2026-08-10).
- [x] All three Ed25519 host fingerprints confirmed and pinned (2026-08-10).
- [x] Protected five-minute chain progression workflow is available on `main` and passing (2026-08-14).
- [x] Dedicated forced-command signing-state backup key installed on the validator (2026-08-10).

External inputs and authority required:

- [ ] Access to the authoritative validator-infra/Ansible repository and inventory.
- [ ] Named Chain/Validator Infra owners and an approved maintenance window.
- [ ] Authority to render intent, fetch non-secret live TOML, apply config, and restart one sentry at a time.
- [ ] KaJ Labs assigns a primary responder, independent backup responder, and approved alert destination.
- [ ] Two independent recovery custodians complete the documented recipient ceremony offline.
- [ ] Add only the resulting public recipient JSON as `BACKUP_RECIPIENT` in `litho-mainnet-backup`; never upload the
      recovery private key.

Remaining actions:

- [ ] Review and merge the audit helper, policy, and runbook without any live snapshots or credentials.
- [ ] In the private repo, remove 40+ unrelated template deltas before permitting a config-tag apply.
- [ ] Render expected TOML, fetch live TOML read-only, and produce the baseline drift report.
- [ ] Align the four identified sentries to `timeout_commit = "500ms"` through Ansible intent.
- [ ] Roll one sentry at a time with peer, catch-up, RPC, consensus, and metrics observation between nodes.
- [ ] Re-audit after rollout and require a clean result.
- [ ] Add scheduled read-only drift detection in the private repo; retain only the sanitized JSON report.
- [ ] Run a controlled monitoring alert and retain delivery/acknowledgement evidence for both responders.
- [ ] Run one successful scheduled encrypted signing-state backup.
- [ ] Perform the isolated, non-signing recovery verification drill and retain its report.

Acceptance criteria:

- [ ] Reviewed Ansible dry-run contains only the approved cleanup delta.
- [ ] Every targeted node passes the policy and exact intent-vs-live audit.
- [ ] No public CometBFT RPC exposure is introduced.
- [ ] All nodes recover peers, remain caught up, and pass the full observation interval.
- [ ] Scheduled detection and alert ownership are active.
- [ ] Encrypted signing-state backup and isolated verification drill pass under two-person recovery custody.
- [ ] Validator Infra, Chain, and CAB approvers, window, report, and evidence are recorded.

Evidence:

- `scripts/validator-config-audit.mjs`
- `config/validator-config-policy.json`
- `docs/runbooks/validator-infra-cleanup.md`
- `docs/VALIDATOR_TEAM_ACTION_ITEMS.md`
- `.github/workflows/mainnet-chain-monitor.yaml`
- `.github/workflows/mainnet-signing-state-backup.yaml`
- `infra/litho-mainnet-9005/ansible/playbooks/mainnet-9005-deploy-monitor-account.yml`
- `infra/litho-mainnet-9005/ansible/playbooks/mainnet-9005-deploy-backup-export.yml`
- Latest passing monitor run: `https://github.com/KaJLabs/Lithosphere/actions/runs/31785149957`
- Latest failed backup run: `https://github.com/KaJLabs/Lithosphere/actions/runs/31782037857` (`BACKUP_RECIPIENT` empty)

## MX-07 — Developer infrastructure toolchain full release

**Owners:** Lithic/compiler team + Dev Infra/release owner + Security reviewer

**Current state:** The workspace expands all eight public tools into functional v0 implementations and adds three-OS
CI/release packaging. Those changes remain local-only. Review of the first shared-syntax/`lithc` slice found that the
local semantic pass inferred an unapproved primitive-type table, overload behavior, map-key restrictions, and return
semantics. PR #95 removed those assumptions, added only unambiguous declaration-name checks, introduced a three-OS
CI gate, passed every gate, and merged as `cf68f7c001cd6a847f806cac09659bf72380bda2`. The tracked release still
describes `lithls`, `lithdev`, `lithtest`, `lithsec`, and `lithpkg` as spec-only stubs. `lithc` still does not
parse/lower full function bodies into deployable LithoVM/EVM bytecode.

| Tool | Local implementation | Required before full-release acceptance |
| --- | --- | --- |
| `lithc` | Lexer/parser, conservative declaration-name checks, and AST/ABI/check output on `main`. | Approved type/overload/map/return semantics, full statements/expressions, typed IR, deterministic bytecode/codegen, source maps, diagnostics, and conformance tests. |
| `lithfmt` | Parse-safe whitespace normalization and `--check`; literal-safety fix under review. | Merge literal preservation, then decide whether v0 is accepted or implement AST-driven canonical formatting/idempotence corpus. |
| `lithlint` | AST-driven L001–L004 rules and warning denial. | Rule/version policy, suppression/config behavior, false-positive corpus, and release documentation. |
| `lithls` | Stdio LSP lifecycle, full sync, diagnostics, and document symbols. | Editor acceptance; decide whether incremental sync, completion, hover, and go-to-definition are release gates. |
| `lithdev` | Devnet lifecycle plus check/deploy preparation and ABI output. | Compiler bytecode, simulation, signing, broadcast, receipt verification, and safe network/account configuration. |
| `lithtest` | Test discovery and deterministic literal assertions. | LithoVM execution, fixtures/isolation, failure traces, coverage decision, and compiler conformance suite. |
| `lithsec` | SEC001–SEC005 capability/storage checks. | Threat-model review, fixtures, severity/suppression policy, and false-positive/negative acceptance. |
| `lithpkg` | Local manifests, local dependencies, and deterministic locks. | Decide whether local-only v0 is accepted; otherwise specify and implement a signed registry and trust policy. |

Completed or evidenced locally:

- [x] All eight binaries have versioned local v0 command implementations.
- [x] Shared parser/semantic front-end is used across applicable tools.
- [x] Local `cargo fmt --check` and Clippy with warnings denied pass (2026-08-03).
- [x] A three-OS CI workflow and release-archive changes exist locally.
- [x] The July readiness run recorded 29 Rust tests and a release build passing in an environment with a linker.
- [x] Inventoried the 1,700+ line local multi-tool change and isolated shared syntax/`lithc` rather than bulk-committing
      unrelated tools (2026-08-16).
- [x] Removed unapproved type, overload, map-key, and return assumptions from the first review candidate; added
      conservative duplicate const/state-field/parameter checks plus `lithc --emit check`.
- [x] Local targeted rustfmt, workspace `cargo check`, and Clippy with warnings denied for the reviewed crates pass.
- [x] Added a three-OS CI candidate to run scoped formatting/Clippy, full workspace tests/release build, and a real
      `lithc` smoke check.
- [x] PR #95 passed Linux, Windows, and macOS formatting, Clippy, 12 Rust tests, full workspace release builds, and
      `lithc` smoke checks, then merged as `cf68f7c001cd6a847f806cac09659bf72380bda2` (2026-08-16).
- [x] Reviewed `lithfmt` and found its claimed safe tab/trailing-space normalization also rewrote string and
      byte-string literal contents; isolated a token-span-based preservation fix and three focused tests.

Remaining actions:

- [x] Merge the reviewed shared syntax/`lithc` and CI slice after its Linux/Windows/macOS gates pass.
- [ ] Separately review `lithfmt`, `lithlint`, `lithls`, `lithdev`, `lithtest`, `lithsec`, `lithpkg`, release packaging,
      examples, and lockfile.
- [ ] Merge the `lithfmt` literal-safety fix after three-OS tests and release builds pass; then record whether the
      whitespace-only v0 formatter is accepted as the release boundary.
- [ ] Run the full workspace tests/release build on Linux, Windows, and macOS. The 2026-08-03 Windows audit host lacks
      `link.exe`, so it could lint/check but could not link Rust test binaries.
- [ ] Specify full function-body grammar, semantics, ABI/bytecode compatibility target, and compiler conformance
      vectors with the LithoVM/chain team.
- [ ] Implement typed function bodies, control flow, storage operations, calls/events/reverts, lowering, deterministic
      bytecode, source maps, and actionable diagnostics.
- [ ] Execute generated contracts in the target VM and compare state, events, calls, gas behavior, and failure cases
      against approved conformance vectors.
- [ ] Complete `lithdev deploy` simulation, signing, broadcast, receipt, and verification only after codegen is trusted.
- [ ] Decide and document the v0 acceptance boundary for formatter, LSP, test runner, scanner, and package registry.
- [ ] Publish signed/checksummed archives for all supported platforms and run install/smoke tests from the artifacts.
- [ ] Obtain independent compiler/security and release-owner acceptance.

Acceptance criteria:

- [ ] `lithc` emits deterministic deployable creation/runtime bytecode for the supported Lithic language.
- [ ] Compiler conformance, negative diagnostics, generated-contract execution, and deployment E2E tests pass.
- [ ] All eight binaries pass required tests/lints/builds on the supported OS matrix.
- [ ] `lithdev deploy` safely simulates, signs, broadcasts, waits, and verifies on an approved devnet account.
- [ ] Versioned archives, manifest, checksums/signatures, release notes, compatibility policy, and install docs are
      published in an immutable release.
- [ ] Compiler/security reviewer and release-owner approvals are recorded.

Evidence:

- `toolchain/README.md`
- `toolchain/Cargo.toml`
- `toolchain/crates/`
- `toolchain/examples/`
- `.github/workflows/ci-toolchain.yaml`
- `.github/workflows/release.yaml`
- `docs/guides/deploy-lithic-on-lithovm-mainnet.md`

## Recommended execution order

1. **Preserve and isolate local work.** Create reviewable stream-specific changes without sweeping up unrelated files.
2. **Send external requests in parallel.** Backend/Bridge, Wallet, DNNS, Quantt, Validator Infra, Chain, treasury,
   security, and release owners can respond while repository work proceeds.
3. **Close LEP100 faucet, Thanos, and DNNS.** These have the smallest remaining engineering surface and produce quick
   operational closures once approvals/funding arrive.
4. **Review and stage MultX/Lithoswap.** Deployment, liquidity, and reversible live tests require explicit authority.
5. **Activate Quantt only after its contract is received.** Do not guess endpoints or place keys in client code.
6. **Perform validator cleanup only in an approved window.** Use the private repo and roll one sentry at a time.
7. **Run the compiler/toolchain track in parallel.** It is the longest critical path and must not be represented as a
   full compiler release until real bytecode is executed successfully on LithoVM.

## Verification ledger

| Date (PKT) | Surface | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-03 | Live Makalu config | PASS | HTTP 200; faucet and bridge enabled, swap disabled. |
| 2026-08-03 | Live faucet inventory | BLOCKED | Native LITHO funded; all ten LEP100 assets below the ten-token minimum. |
| 2026-08-03 | Live Quantt status | BLOCKED | HTTP 200; adapter deployed, `configured: false`. |
| 2026-08-03 | Quantt public endpoints | PARTIAL | Research site HTTP 200; dev hostname TLS verification fails. |
| 2026-08-03 | API | PASS | 163 tests passed; 9 live integration tests skipped; TypeScript build passed. |
| 2026-08-03 | Explorer | PARTIAL | 126 tests passed; lint warning-only. Standalone `tsc --noEmit` failed on test `ProcessEnv` and ES target settings. |
| 2026-08-03 | Contracts | PASS | 9 Hardhat tests passed, including 4 Lithoswap cases; compile passed. |
| 2026-08-03 | Faucet | PASS | TypeScript build passed. No live LEP100 claim could pass due to balances. |
| 2026-08-03 | Validator auditor | PASS | Self-test passed. Live validator inventory was not accessed. |
| 2026-08-03 | Rust toolchain | PARTIAL | Format and Clippy passed. Tests/build could not link because `link.exe` is absent on this host. |
| 2026-08-14 | Live Makalu config | PASS | HTTP 200; faucet and bridge enabled, swap disabled. |
| 2026-08-14 | Live faucet inventory | BLOCKED | Ten LEP100 assets present; five at zero and five at five, below minimum claim ten. |
| 2026-08-14 | Faucet safeguards | MERGED | PR #80 merged as `ef509281`; seven tests and strict TypeScript build passed. |
| 2026-08-14 | Faucet deployment | BLOCKED | No faucet image was published/deployed; live API still serves the previous payload. |
| 2026-08-14 | Faucet image pipeline | PASS | PR #82 merged as `f6303f9`; merged image run passed build, pre-publish Trivy gate, signing, provenance, and SBOM for all four services. No production deploy triggered. |
| 2026-08-14 | Faucet production release | BLOCKED | Rotate the exposed funding key, install the reviewed protected wrappers, replenish approved reserves, then run the manual gated release. |
| 2026-08-14 | Thanos deployment | PARTIAL | `/signin` and `/api/auth/nonce` respond; wallet-team acceptance remains. |
| 2026-08-14 | Thanos published release | PASS | Chrome Web Store reports `0.9.33`; matching source commit `c352a5cfef22` confirms EIP-6963, `fi.thanos.wallet`, `window.thanos`, and signing support. |
| 2026-08-14 | Thanos production auth | PASS | Makalu API secret checked value-free: present, non-placeholder, and at least 32 characters. `/signin` 200, nonce 200 with valid format, unauthenticated `/api/auth/me` 401. |
| 2026-08-14 | Thanos repository verification | PASS | API: 6 focused tests and TypeScript build passed. Explorer: all 128 tests passed; Next compilation/type validation passed before Windows denied standalone symlink creation. |
| 2026-08-14 | Thanos merge | PASS | PR #83 passed all 15 checks and merged as `6ded419ca7034f9ded110255dd1a2683d3399029`. |
| 2026-08-14 | Thanos deployment | ROLLED BACK | Run `31819790372` served the correct release SHA and passed core routes, but an incorrectly coupled faucet-schema condition failed; automatic rollback passed and restored the prior healthy release. |
| 2026-08-14 | Thanos deployment retry | PASS | PR #84 merged as `4fdb3ca`; run `31822244365` attempt 2 passed the core public gate. Live version, `/signin`, `/nfts`, stats, and nonce probes passed; faucet container start time and image remained unchanged. |
| 2026-08-14 | DNNS registry | PASS | Kamet chain ID 900523; configured registry address contains contract bytecode. |
| 2026-08-14 | DNNS forward records | PASS | All nine deployment-reserved `.litho` names resolve to the expected checksum address through their registry-selected resolver. |
| 2026-08-14 | DNNS reverse record | BLOCKED | The reverse node for the reserved-name address has no resolver; DNNS owner must configure or nominate a stable fixture. |
| 2026-08-14 | DNNS repository verification | PASS | All 134 explorer tests passed. Next compilation/type validation and static generation passed; Windows standalone symlink creation was denied by local OS policy. |
| 2026-08-14 | DNNS merge and deployment | PASS | PR #86 passed all checks and merged as `c5448da`; protected run `31826844798` deployed that exact release and passed the public health gate. |
| 2026-08-14 | DNNS post-deployment smoke | PASS | Public version reports `c5448da`; home/blocks return 200, shipped validation text is present, and `makalu.litho`/`faucet.litho` resolve to the expected address. |
| 2026-08-14 | Quantt | BLOCKED | Live adapter reports `configured: false`; development hostname fails TLS validation. |
| 2026-08-14 | Quantt public surfaces | PARTIAL | Research portal HTTP 200. `dev.quantt.at` resolves, but its certificate covers only `quantts.ai` names; the similar domain is not approved as a replacement. |
| 2026-08-14 | Quantt activation audit | IN PROGRESS | Base URL/key gate exists, but auth and path defaults were guessed. Local hardening requires both explicitly and adds the missing acceptance record. |
| 2026-08-14 | Quantt repository verification | PASS | Five focused tests and all 164 API tests passed; nine live-integration tests remained intentionally skipped; strict TypeScript build passed. |
| 2026-08-14 | Quantt merge and deployment | PASS | PR #88 passed all checks and merged as `c01ec48`; protected run `31828985116` deployed that exact release and passed the public health gate. |
| 2026-08-14 | Quantt post-deployment smoke | PASS (disabled) | Public version reports `c01ec48`; page is HTTP 200, status is unconfigured with null origin, and insights fail closed with HTTP 503. |
| 2026-08-14 | Mainnet chain monitor | PASS | Three latest inspected protected runs passed. |
| 2026-08-14 | Signing-state backup | BLOCKED | Scheduled workflow fails closed because `BACKUP_RECIPIENT` is empty. |
| 2026-08-15 | MultX live feature state | PASS (disabled swap) | Config reports bridge enabled and swap disabled; `/swap` and `/cross-swap` return 200 with unavailable states. |
| 2026-08-15 | MultX v0.5 redeployment gates | MERGED | PR #75 passed all checks and 84 local Hardhat tests after UTC-window enforcement; merged as `5570c95` with no deployment. |
| 2026-08-16 | MultX signer proposal | CLOSED | AWS KMS/IAM PR #78 was closed without merge; current `main` retains the provider-neutral VPS signer/quorum implementation for separate review. |
| 2026-08-15 | MultX toolchain audit | PARTIAL | `npm audit --omit=dev` reports zero; full operational/test dependency audit reports 3 critical and 14 high transitive findings. |
| 2026-08-16 | Lithoswap V2 repository review | MERGED | PR #68 passed every repository check and merged as `07b37969`; current-main build, 28 full Hardhat tests, 23 focused DEX/configuration tests, nine E2E checks, strict TypeScript, and Slither with zero detectors passed. No deployment or funding occurred. |
| 2026-08-16 | Lithoswap V2 toolchain audit | PARTIAL | Contract package has no production runtime dependencies; its Hardhat/test-only dependency graph reports 1 critical, 55 high, 43 moderate, and 10 low transitive advisories. |
| 2026-08-16 | Provider-neutral signer review | MERGED | PR #93 passed all checks and merged as `60f3f7bb`; 11 signer, 18 API, and 88 bridge-contract tests pass; all three production dependency audits report zero. No deployment or key access occurred. |
| 2026-08-16 | Toolchain shared front-end review | MERGED | PR #95 passed on Linux, Windows, and macOS with 12 Rust tests, full workspace release builds, Clippy/formatting, and `lithc` smoke checks; merged as `cf68f7c0`. |
| 2026-08-16 | `lithfmt` safety review | PASS, LOCAL | Found literal-content corruption in the whitespace formatter; token-span preservation and three focused regression/idempotence tests pass check/Clippy locally and await three-OS PR CI. |

## Change log

### 2026-08-16 — MX-07 `lithfmt` safety fix isolated

- Verified the local draft contained no formatter behavior change beyond a release version bump and mechanical
  formatting; the version bump was not accepted without full-release approval.
- Found that the tracked formatter expanded tabs inside string/byte-string literals and could trim trailing content
  inside multiline literals despite describing itself as unable to corrupt a contract.
- Added lexer-token-span protection so literal bytes remain unchanged while external whitespace is normalized, plus
  literal, multiline, and idempotence tests.
- Expanded the three-OS toolchain gate to format and lint `lithfmt`; hosted tests/release builds await PR CI.
- Updated by: `bachal-mb`.

### 2026-08-16 — MX-07 shared front-end and CI merged

- PR #95 passed Linux, Windows, and macOS formatting, reviewed-crate Clippy with warnings denied, all 12 Rust tests,
  full workspace release builds, and a real `lithc --emit check` smoke test against `DOGE.lithic`.
- All standard repository gates also passed; PR #95 merged by `bachal-mb` as
  `cf68f7c001cd6a847f806cac09659bf72380bda2`.
- This closes only the first review slice. The remaining tools, compiler semantics, codegen, conformance, packaging,
  and release acceptance remain open, and no deployable compiler artifact is claimed.
- Updated by: `bachal-mb`.

### 2026-08-16 — MX-07 shared front-end review isolated

- Inventoried the uncommitted toolchain work without modifying the original dirty workspace and isolated the shared
  syntax/`lithc` slice from the other tools, examples, lockfile, and release packaging.
- Rejected the local semantic pass's unapproved primitive-type, overload, map-key, and return assumptions.
- Added only conservative duplicate const, state-field, and parameter checks plus an honest `lithc --emit check`
  mode that does not claim full type checking or code generation.
- Added Linux/Windows/macOS CI for scoped format/Clippy, full workspace tests and release build, and a compiler smoke
  test. Local targeted rustfmt, workspace check, and reviewed-crate Clippy pass; hosted linker-backed CI is pending.
- No compiler release or deployable bytecode is claimed or published.
- Updated by: `bachal-mb`.

### 2026-08-16 — MX-01 provider-neutral signer hardening merged

- Every required/reporting check on PR #93 passed, including CodeQL, contracts, Foundry invariants, signer, API
  image, web, build, lint, typecheck, schema/ABI, and secret scanning.
- PR #93 merged by `bachal-mb` as `60f3f7bb151e9e2be48632468212e602220f40f4`.
- Repository hardening is complete; independent audit and operator acceptance remain required before any privileged
  deployment, followed by explicit controller and liquidity approvals before Swap can be enabled.
- No signer or contract was deployed, no key was accessed, no liquidity was funded, and Swap remains disabled.
- Updated by: `bachal-mb`.

### 2026-08-16 — MX-01 provider-neutral signer review hardened locally

- Verified the EIP-191 message domain matches both destination contracts, the API verifier, and release executor.
- Closed malformed-policy confirmation bypasses and rejected insecure/credential-bearing RPC and signer URLs,
  duplicate sources/routes, and zero critical addresses.
- Removed the static-network trust shortcut so the signer verifies the RPC's reported chain ID.
- Changed anti-equivocation handling to fsync the decision before signing; added restart and corrupt-journal tests.
- Rejected duplicate signer identities and invalid timeouts, serialized signing polls, counted only distinct current
  configured signer addresses, and removed implicit source-chain/release-token fallbacks.
- Made both bridge implementations reject duplicate validator identities at deployment and during rotation.
- Updated status/signature responses to expose the configured threshold, distinct counts, and deterministic lowercase
  signer ordering.
- Signer: 11 tests pass; API: 18 tests pass; bridge contracts: 88 tests pass; all three production dependency audits
  report zero vulnerabilities.
- No signer was deployed, no key was accessed, and no production configuration was changed.
- Updated by: `bachal-mb`.

### 2026-08-16 — MX-01 Lithoswap V2 repository slice merged

- Updated PR #68 to current `main` without touching the unrelated dirty workspace.
- Added critical-address and pair-initialization contract guards plus production invariant and flash-swap reentrancy
  tests.
- Removed the default WLITHO/deployer-controller assumptions. Deployment now requires explicit chain, WLITHO,
  fee-controller, clean-source, confirmation, receipt, manifest, and runtime-code-hash checks.
- Made liquidity seeding read-only by default, bound it to a versioned approved plan, exact initial ratios, an LP
  recipient, on-chain token metadata, and a separate chain-bound execution confirmation.
- Full/focused tests, E2E, strict TypeScript, and Slither passed. The test/deployment toolchain's transitive
  advisories are explicitly recorded; it must use a hardened ephemeral runner with trusted inputs.
- No contract was deployed, no token approval was sent, no liquidity was funded, and Swap remains disabled.
- Closed stale conflicting UI PR #69 as superseded by the tested, fail-closed Swap UI already on `main`.
- All current-head PR checks passed; PR #68 merged by `bachal-mb` as
  `07b37969f00d97eaca17794c31a83546b60a1940` without deployment or funding.
- Reverified AWS PR #78 unchanged, closed it as rejected architecture, and retained the non-AWS VPS signer path on
  `main` for separate operational review.
- Updated by: `bachal-mb`.

### 2026-08-15 — MX-01 MultX redeployment gates merged; swap remains disabled

- Reconciled `main`, the original dirty workspace, open PRs, and live feature state. Same-chain Lithoswap V2 source
  remains local-only; no router or liquidity deployment is recorded.
- Reviewed PR #75 and found its documented change-window gate was not enforced. Added explicit UTC start/end fields
  and blocked execution outside the interval before private-key access or transaction signing.
- All 84 Hardhat tests, compilation, and every PR check passed. PR #75 merged as
  `5570c959c4dc746a5fdae28c859318d963b0a7ae`; no contract deployment was executed.
- Recorded the deployment toolchain's full transitive audit findings rather than relying only on the empty
  production-dependency result.
- Formally blocked AWS-specific PR #78 from merge and requested a provider-neutral, non-AWS signer redesign.
- Live bridge remains enabled and swap remains disabled/unavailable.
- Updated by: `bachal-mb`.

### 2026-08-14 — MX-05 gates merged and deployed; Quantt owner inputs remain

- PR #88 passed every required/reporting check and merged as
  `c01ec48472544270ec0716483e5a07bba947b079` by `bachal-mb`.
- Protected deployment run `31828985116` published and deployed that exact core release and passed the public health
  gate without touching the faucet.
- Post-deployment probes confirmed the Quantt page is available while its API remains safely unconfigured: status
  exposes no origin and insights return HTTP 503.
- MX-05 is now an external blocker on the canonical API contract/credential, developer TLS repair or approved
  replacement, product decisions, exact schema implementation, live tests, and owner acceptance.
- Updated by: `bachal-mb`.

### 2026-08-14 — MX-05 verified and assumption-based activation removed locally

- Reverified the deployed adapter is disabled, the research portal is healthy, and standards-valid access to
  `dev.quantt.at` fails hostname verification.
- Inspected the presented certificate: it covers `quantts.ai` hosts, not the requested `dev.quantt.at`. The similar
  domain was observed but deliberately not substituted without Quantt-owner approval.
- Changed local configuration loading to require an explicit approved auth header and insights path rather than
  defaulting to an assumed Bearer scheme and `/api/v1/insights`.
- Added `docs/integrations/quantt.md` with verified evidence, exact owner inputs, activation sequence, acceptance
  criteria, and approval fields.
- Five focused Quantt tests, all 164 API tests, and the strict TypeScript build passed.
- Updated by: `bachal-mb`.

### 2026-08-14 — MX-04 merged and deployed; owner acceptance remains

- PR #86 passed every required/reporting check and merged as
  `c5448da8c617cf06083f9c08be7e08bd1b5cb6b2` by `bachal-mb`.
- Protected deployment run `31826844798` published the immutable image, recreated only the core explorer services,
  and passed the public health gate. The faucet remained outside the deployment.
- The public API reports the exact release SHA; home and blocks return 200; the shipped explorer bundle contains the
  new malformed-name validation; and fresh chain probes reconfirmed `makalu.litho` and `faucet.litho`.
- MX-04 is now an external blocker: the DNNS owner must confirm the supported interface, correct the public docs,
  supply one reverse fixture, approve the cache policy, and record acceptance.
- Updated by: `bachal-mb`.

### 2026-08-14 — MX-04 deployed interface verified and explorer hardened

- Traced the explorer configuration to the deployed Kamet v0 metadata instead of assuming the public reference
  documentation represented a live migration.
- Confirmed registry bytecode and all nine reserved forward records directly on chain. The deployed reverse node is
  unset, so reverse acceptance remains an owner action rather than an explorer code task.
- Removed process-lifetime record caching, enforced the deployed 2LD normalization rules, distinguished resolver
  outages from missing records, and required forward verification before displaying a reverse name.
- Added the evidence and owner sign-off fields in `docs/dnns-acceptance.md`.
- All 134 explorer tests passed. Next compilation, type validation, and static generation passed; the final local
  standalone-copy step remains blocked by Windows symlink policy and will be rechecked by Linux CI.
- Updated by: `bachal-mb`.

### 2026-08-14 — MX-03 merged and deployed; wallet acceptance remains

- PR #83 passed all checks and merged as `6ded419ca7034f9ded110255dd1a2683d3399029`.
- Deployment run `31819790372` served the new release and passed the explorer routes, but the core workflow also
  required the intentionally undeployed MX-02 faucet schema. The gate failed and automatic rollback succeeded.
- Verified the protected host scripts deploy only explorer, API, and indexer. Updated the repository copies and CI
  gate to match that isolation; PR #84 passed all checks and merged as `4fdb3ca5a4bcb0d24978189ce158028ae6247984`.
- The first PR #84 deployment attempt hit a transient GHCR `EOF` before recreation and rolled back successfully.
  Attempt 2 passed the public gate and deployed the expected release to explorer, API, and indexer.
- Public probes returned 200 for `/signin`, `/nfts`, stats, and nonce issuance. The live faucet retained its prior
  image and 2026-06-20 start time, confirming it was not part of the deployment.

### 2026-08-14 — MX-03 repository verification and wallet-team handoff

- Verified the currently published Chrome extension as `0.9.33` and checked its matching source instead of assuming
  compatibility from the newer unreleased repository version.
- Added a `window.thanos` fallback matching the official provider surface and automated both that path and late
  EIP-6963 announcement discovery.
- Verified the Makalu production session-secret gate without printing the secret and probed the live authentication
  routes.
- Added `docs/thanos-wallet-acceptance.md` with the exact remaining browser, restart, transaction, evidence, and
  approver fields. MX-03 remains open until the wallet team completes that record.

### 2026-08-14 — MX-02 secured image pipeline merged; production held safely

- PR #82 merged to `main` as `f6303f9d39f3c8075284dc73ecb65d4b3556e7eb` after all 13 PR checks passed.
- A faucet-only candidate exposed `CVE-2026-59873` in npm's bundled `node-tar`; runtime package managers were removed
  and the image passed a fresh CRITICAL Trivy gate before publication.
- Changed image publishing to build and scan locally before pushing, preventing future fixable CRITICAL findings
  from being published by the workflow.
- Merged image run `31814888627` completed all four services; the faucet image was signed, provenance-attested, and
  supplied with an SBOM at digest `sha256:34391877a9029461dfc261ce1ed0704b791d19f9065c0367a297952e49be12d8`.
- Confirmed faucet releases remain manual and no production deployment ran for the merge.
- Production remains blocked on funding-key rotation, protected-wrapper installation, treasury replenishment, live
  claims, and alert ownership.
- Updated by: `bachal-mb`.

### 2026-08-14 — MX-02 safeguards merged; deployment gap identified

- PR #80 merged to `main` as `ef5092812cddc591836657cea6197f8aa2f46fac`; all reported PR checks/statuses passed.
- Confirmed the live faucet still serves the prior payload after merge.
- Confirmed `publish-images.yaml` excludes the faucet, `deploy-simple.yaml` does not trigger on faucet changes, and
  the protected VPS deploy/rollback wrapper currently covers only web/API.
- MX-02 advanced from merge review to an external deployment-infrastructure blocker; funding, live claims, and
  per-token alert ownership remain open.
- Updated by: `bachal-mb`.

### 2026-08-14 — Sequential closure tracking and MX-02 repository safeguards

- Revalidated all seven streams against `origin/main`, open PRs, protected workflows, and live endpoints.
- Updated MX-06 with installed restricted monitor/backup identities, active chain monitoring, and the exact
  `BACKUP_RECIPIENT` custody blocker.
- Completed the local MX-02 fail-closed availability slice and added seven passing tests covering zero,
  below-minimum, malformed, balance-read failure, fractional precision, funded amount filtering, and successful
  route behavior.
- Faucet strict TypeScript build passed.
- MX-02 remains open at the merged/deployed/accepted gates: review, deployment, treasury replenishment, ten live
  claims, alert routing, and replenishment ownership are not complete.
- Updated by: `bachal-mb`.

### 2026-08-03 — Initial living handoff

- Consolidated repository, live-service, dependency, acceptance, and release state for all seven streams.
- Detected that `/api/quantt/status` changed from the July 22 HTTP 404 observation to HTTP 200, but remains
  intentionally unconfigured.
- Reconfirmed live bridge enabled and swap disabled.
- Reconfirmed every configured LEP100 faucet asset is below the minimum claim amount.
- Updated verification counts to API 163 passing tests and explorer 126 passing tests.
- Recorded the local-only delivery risk for DEX contracts/scripts, faucet safeguards, validator audit assets, and the
  expanded developer toolchain/CI.

## Update template

Append one entry whenever a material fact changes:

```markdown
### YYYY-MM-DD — MX-0N short description

- Previous gate/status:
- New gate/status:
- What changed:
- Evidence (PR/commit/release/deploy/test/approval):
- Remaining blocker or next action:
- Updated by:
```

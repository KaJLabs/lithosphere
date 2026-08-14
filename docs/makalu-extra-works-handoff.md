# Makalu extra works — living handoff

- **Status:** Active — closing one stream at a time
- **Last verified:** 2026-08-14 15:26 PKT (UTC+05:00)
- **Repository:** `KaJLabs/Lithosphere`
- **Default branch inspected:** `origin/main` at `5db05ad0e5fc396b0a1c532dff84d5d69f06adee`
- **Latest merged closure:** PR #82 at `f6303f9d39f3c8075284dc73ecb65d4b3556e7eb`
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
| MX-03 | Thanos Wallet | Merged and deployed; acceptance open | IN PROGRESS | Complete wallet-team browser and signed-transaction acceptance. |
| MX-04 | DNNS | Merged and deployed; live-name acceptance open | EXTERNAL BLOCKER | Obtain two stable test names and DNNS interface/cache confirmation. |
| MX-05 | Quantt | Adapter deployed but deliberately unconfigured | EXTERNAL BLOCKER | Obtain API contract/credential and repair or replace the development TLS endpoint. |
| MX-01 | MultX / Lithoswap | Candidate source merged; Makalu swap disabled | IN PROGRESS | Resolve open DEX PRs, audit, deploy, seed approved liquidity, and run live acceptance. |
| MX-07 | Developer toolchain | Expanded v0 local-only; no deployable compiler/release | IN PROGRESS, LOCAL ONLY | Review local tools, then implement compiler lowering/codegen and conformance. |

## Sequential closure queue

Only one repository stream is active at a time. An external blocker is recorded and escalated, then work advances
to the next executable stream without pretending the blocked stream is complete.

1. [ ] **MX-06 Validator cleanup and safety** — waiting on responder/custodian governance and public backup recipient.
2. [ ] **MX-02 LEP100 faucet assets** — safeguards and image publishing merged; key rotation, VPS wrapper activation, funding, live claims, and alerts remain.
3. [ ] **MX-03 Thanos Wallet** — next after MX-02 repository work is verified.
4. [ ] **MX-04 DNNS** — waiting on stable test records and team confirmation.
5. [ ] **MX-05 Quantt** — waiting on API/TLS/product contract.
6. [ ] **MX-01 MultX / Lithoswap** — security, deployment, liquidity, and acceptance remain.
7. [ ] **MX-07 Developer toolchain** — separate major compiler/release program.

## MX-01 — MultX Swap / Lithoswap

**Owners:** Dev Infra + Backend/Bridge team + contract deploy authority + approved liquidity owner

**Current state:** The MultX bridge UI/API integration is merged and the live feature configuration reports the bridge
enabled. The same-chain Lithoswap DEX contracts, deployment scripts, liquidity scripts, E2E script, tests, and subgraph
exist in the workspace, but the contract sources/scripts are not tracked on `main`. The live feature configuration
reports `swap: false`; `/swap` and `/cross-swap` render unavailable states.

Completed or evidenced:

- [x] MultX bridge UI and same-origin API proxy are present.
- [x] Makalu/Kamet bridge addresses and the LEP100 token map are encoded.
- [x] Lock, status/signature polling, history, and release/claim paths exist.
- [x] Local Lithoswap V2 factory/router/pair and deployment/liquidity/E2E scripts exist.
- [x] Nine contract tests pass, including four Lithoswap tests (2026-08-03).
- [x] Live config reports `bridge: true` (2026-08-03).

Remaining actions:

- [ ] Separate the DEX contracts, scripts, tests, subgraph, explorer configuration, and CI changes from unrelated
      working-tree changes; open and review the resulting PR(s).
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
- Live probes: `https://makalu.litho.ai/api/config`, `https://makalu.litho.ai/swap`,
  `https://makalu.litho.ai/cross-swap`

## MX-02 — LEP100 Lithic-native assets on the faucet

**Owners:** Dev Infra + faucet deploy owner + token treasury/contract owners

**Current state:** The live faucet exposes native LITHO plus ten LEP100 assets. Native LITHO is funded. Every LEP100
asset is below its minimum ten-token claim: WLITHO, LITBTC, JOT, COLLE, and FGPT have zero; LAX, IMAGE, AGII, BLDR,
and MUSA have five. Balance-aware, fail-closed API and explorer behavior passed seven focused tests plus a strict
TypeScript build. PR #80 merged those safeguards on 2026-08-14. PR #82 then merged secured faucet image publishing,
pre-publication vulnerability gating, immutable image waiting, a public faucet-schema gate, and source-controlled
deploy/rollback wrappers as `f6303f9d39f3c8075284dc73ecb65d4b3556e7eb`. The merged faucet image passed Trivy,
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
- [x] Extend the manual Makalu release workflow's immutable image wait and public health gate to cover the faucet
      image and new availability fields; keep faucet releases manual until the funding/wrapper gates pass.
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

**Current state:** Thanos is integrated as the EIP-6963 injected provider `fi.thanos.wallet`. Direct discovery,
network addition/switching, SIWE message signing, signature normalization, nonce verification, replay protection,
bearer sessions, and disconnect behavior are implemented. Repository tests pass; wallet-team browser acceptance and
production-secret evidence remain open.

Completed or evidenced:

- [x] Thanos EIP-6963 discovery and prioritization are merged.
- [x] Direct “Sign in with Thanos” flow and install fallback are merged.
- [x] Makalu chain enforcement and add/switch-network flow exist.
- [x] Server-validated nonce/SIWE/session flow with replay protection exists.
- [x] API auth tests and explorer wallet/auth tests pass (2026-08-03).

Remaining actions:

- [ ] Verify deployment uses a stable, secret-managed `AUTH_SESSION_SECRET` of at least 32 characters without
      exposing its value.
- [ ] Wallet team tests the currently supported extension version in Chrome/Chromium and records the version.
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

## MX-04 — DNNS integration

**Owners:** Dev Infra + DNNS team

**Current state:** Forward `.litho` search and reverse address display are merged and tested. Resolution reads the
DNNS registry on Kamet (`900523`) through `https://rpc-3.litho.ai`. The integration still needs known-name live tests,
an agreed cache policy, and DNNS-team acceptance.

Completed or evidenced:

- [x] Namehash, `.litho` detection, forward resolution, and reverse resolution exist.
- [x] Explorer search navigates resolved names to address pages.
- [x] Address pages can display reverse-resolved names.
- [x] Five DNNS tests pass (2026-08-03).

Remaining actions:

- [ ] Obtain at least two stable registered test names and expected addresses from the DNNS team.
- [ ] Confirm the registry/resolver addresses, Kamet RPC, TLD, normalization rules, and reverse-record rules as the
      supported production interface.
- [ ] Agree on positive and negative cache TTLs; replace process-lifetime negative caching if records must become
      visible without a page/process restart.
- [ ] Smoke-test forward and reverse resolution from the deployed explorer, including missing/malformed names and
      RPC failure.
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
- Public DNNS documentation: `https://dnns.litho.ai/`

## MX-05 — Quantt integration

**Owners:** Dev Infra + Quantt team + product owner

**Current state:** The credentials-safe server proxy, explorer page, normalizer, tests, OpenAPI paths, configuration,
and runbook are implemented. The live status endpoint now exists but reports `configured: false`. The public research
site responds, while `dev.quantt.at` fails hostname verification. The adapter intentionally fails closed without an
approved API contract and key.

Completed or evidenced:

- [x] HTTPS and `quantt.at` hostname allow-listing exist.
- [x] Server-only authentication, symbol validation, bounded timeouts, and sanitized upstream errors exist.
- [x] `/api/quantt/status`, `/api/quantt/insights`, `/quantt`, tests, and OpenAPI documentation exist.
- [x] Live `/api/quantt/status` returns HTTP 200 and safely reports unconfigured (2026-08-03).

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
CI/release packaging. Those changes remain local-only. The tracked `main` version still describes `lithls`, `lithdev`,
`lithtest`, `lithsec`, and `lithpkg` as spec-only stubs. Even in the local implementation, `lithc` stops after parsing,
semantic checks, AST/ABI output; it does not parse/lower full function bodies into deployable LithoVM/EVM bytecode.

| Tool | Local implementation | Required before full-release acceptance |
| --- | --- | --- |
| `lithc` | Lexer, declarations, semantic/name/type checks, AST/ABI/check output. | Full statements/expressions, typed IR, deterministic bytecode/codegen, source maps, diagnostics, and conformance tests. |
| `lithfmt` | Parse-safe whitespace normalization and `--check`. | Decide whether v0 is accepted or implement AST-driven canonical formatting/idempotence corpus. |
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

Remaining actions:

- [ ] Split and review the shared syntax/sema changes, each public tool, CI, release packaging, examples, and lockfile.
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
| 2026-08-14 | DNNS registry | PASS | Kamet chain ID 900523; configured registry address contains contract bytecode. |
| 2026-08-14 | Quantt | BLOCKED | Live adapter reports `configured: false`; development hostname fails TLS validation. |
| 2026-08-14 | Mainnet chain monitor | PASS | Three latest inspected protected runs passed. |
| 2026-08-14 | Signing-state backup | BLOCKED | Scheduled workflow fails closed because `BACKUP_RECIPIENT` is empty. |

## Change log

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

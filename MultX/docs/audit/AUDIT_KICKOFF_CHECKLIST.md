# MultX Bridge Audit — NDA & Kickoff Checklist

**Purpose:** execute the audit cleanly the moment the client green-lights (see [`AUDIT_DECISION_BRIEF.md`](./AUDIT_DECISION_BRIEF.md)).
**Owners:** **[C]** = client/leadership · **[I]** = infra team · **[F]** = audit firm.
**Companion docs:** [`AUDIT_RFQ.md`](./AUDIT_RFQ.md) · [`MULTX_THREAT_MODEL.md`](./MULTX_THREAT_MODEL.md) · [`slither-pre.txt`](./slither-pre.txt)

---

## Phase 0 — Engage (on green-light)

- [ ] **[C]** Approve budget (~$20k–$50k) and select firm (or authorize [I] to run the RFQ and return quotes).
- [ ] **[I]** Send the RFQ (`client-work/MultX-Bridge-Audit-RFQ.pdf`) to the chosen firm(s); collect quotes (fee, lead time, duration, team, re-audit terms, public-report OK).
- [ ] **[C]** Confirm the winning quote; **[C]** sign the vendor contract + handle payment terms (per RFQ §7 — client owns the commercial relationship).
- [ ] **[C/F]** Sign the firm's **mutual NDA** before any code is shared.
- [ ] **[I]** Agree start date + primary comms channel; name the [I] technical point of contact for the engagement.

## Phase 1 — Freeze the code

> ⚠️ **The freeze commit is NO LONGER `9f939ab`.** Since the RFQ was drafted, the
> in-scope contracts gained the **`pauseGuardian` governance role** (owner-OR-guardian
> `pause()`, owner-only `unpause()`/config — see ADR `0004-multx-bridge-governance.md`)
> and a **full NatSpec pass**. These are intentional pre-audit hardening and must be in
> the frozen scope. Re-take the freeze at the current `kamet-mainnet-prep` tip and
> **update the RFQ's commit reference** before sending.

- [ ] **[I]** Confirm the 3 in-scope files are final, with **no pending contract changes** after the governance + NatSpec work:
      `contracts/contracts/{MultXBridge,MultXBridgeDest,WrappedLEP100}.sol`.
- [ ] **[I]** Sanity-check that the only diff vs `9f939ab` is the guardian role + NatSpec (no unexpected logic drift):
      ```bash
      git diff 9f939ab8501bd351024ffc7ca5e884a3090c3ecc..HEAD -- \
        contracts/contracts/MultXBridge.sol \
        contracts/contracts/MultXBridgeDest.sol \
        contracts/contracts/WrappedLEP100.sol
      # expect: pauseGuardian additions + doc comments only
      ```
- [ ] **[I]** Tag the freeze at the current tip: `git tag audit-freeze-<date> <commit> && git push origin audit-freeze-<date>`.
- [ ] **[I]** Verify the frozen bytecode == what will deploy to mainnet (`solc 0.8.24`, optimizer runs 200) — record the build hash.
- [ ] **[I]** Share a read-only snapshot at the frozen commit (private repo invite **or** tarball — firm's preference).

## Phase 2 — Hand over the package

- [ ] **[I]** Deliver: threat model, triaged Slither report, Hardhat test suite (`contracts/test/`), Foundry invariant suite (`contracts/test/foundry/`), deployment records (`contracts/deployments/`), and operator runbooks (`docs/operations/{BRIDGE_RUNBOOK,VALIDATOR_KEY_ROTATION}.md`).
- [ ] **[I]** Deliver the **test-coverage report** (`cd contracts && npm run coverage`). Baseline at freeze prep (2026-06-30, 72 Hardhat tests passing):

      | File | % Stmts | % Branch | % Funcs | % Lines |
      |---|---|---|---|---|
      | MultXBridge.sol | 86.21 | 55.26 | 71.43 | 83.33 |
      | MultXBridgeDest.sol | 98.33 | 84.21 | 85.71 | 98.68 |
      | WrappedLEP100.sol | 100 | 100 | 100 | 100 |
      | governance/GovTimelock.sol | 100 | 100 | 100 | 100 |

      ⚠️ **Known gap:** `MultXBridge.sol` branch coverage (55%) trails `MultXBridgeDest.sol`
      (84%) — the source-bridge test file predates the daily-cap/guardian hardening, so
      its revert/edge branches are under-exercised. Recommend bringing the two suites to
      parity (daily-cap reset + exceeded paths, guardian-pause negative cases,
      `getDailyRemaining` branches) before or during the engagement. The Foundry invariant
      suite covers the core solvency/nonce/release properties independently.
- [ ] **[I]** Flag the 5 specific opinions requested (RFQ §5): signature-scheme/malleability (EIP-712?), daily-cap boundary, pause semantics on `releaseTokens`, validator-set rotation grace period, `WrappedLEP100` mint authority.
- [ ] **[I]** Explicitly ask the firm to grade **L1** (single-EOA owner → recommend Gnosis Safe multisig) as REQUIRED-BEFORE-MAINNET or not.

## Phase 3 — During the audit

- [ ] **[I]** Technical POC available for questions; log Q&A in the shared channel.
- [ ] **[I/F]** Mid-engagement check-in; surface any preliminary critical/high early.

## Phase 4 — Findings & remediation

- [ ] **[F]** Deliver draft report (severity-classified).
- [ ] **[I]** Triage: **Critical/High → must fix**; **Medium → fix or document risk acceptance**; **Info → fix at discretion**.
- [ ] **[I]** Implement fixes on a branch; re-run tests + Slither.
- [ ] **[F]** Remediation re-review round; confirm all C/H resolved.
- [ ] **[C]** Decide on L1 (deploy Gnosis Safe as bridge owner before mainnet if the firm flags it required).
- [ ] **[F/C]** Finalize report; **[C]** approve public publication (we intend to publish).

## Phase 5 — Mainnet gate (the unblock)

- [ ] **[I]** Publish the final report (GitHub + linked from docs).
- [ ] ✅ **Gate cleared** → proceed with mainnet rollout: deploy the audited `MultXBridge` + 33 `WrappedLEP100` to ETH/BNB/Base mainnet (M4.3), then DNNS mainnet (M3) and launch coordination (M7).

---

**Bottleneck note:** Phase 0 is the only step gated on the client. Phases 1–2 are ~1 day of [I] work and can be staged in advance so the firm starts on day one.

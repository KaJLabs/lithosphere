# MultX Bridge Audit — NDA & Kickoff Checklist

**Purpose:** execute the audit cleanly the moment the client green-lights (see [`AUDIT_DECISION_BRIEF.md`](./AUDIT_DECISION_BRIEF.md)).
**Owners:** **[C]** = client/leadership · **[I]** = infra team · **[F]** = audit firm.
**Companion docs:** [`AUDIT_RFQ.md`](./AUDIT_RFQ.md) · [`MULTX_THREAT_MODEL.md`](./MULTX_THREAT_MODEL.md) · [`slither-pre.txt`](./slither-pre.txt)

---

## Phase 0 — Engage (on green-light)

- [ ] **[C]** Approve the contract-audit budget (~$20k–$50k), authorize a
      separately itemized signer-protocol quote, and select a firm (or
      authorize [I] to run the RFQ and return exact quotes).
- [ ] **[I]** Send the current RFQ (`AUDIT_RFQ.md`) and the new immutable v0.8
      source bundle after merge/CI/tag to the chosen firm(s); collect quotes (fee, lead time,
      duration, team, re-audit terms, public-report approval).
- [ ] **[C]** Confirm the winning quote; **[C]** sign the vendor contract + handle payment terms (per RFQ §7 — client owns the commercial relationship).
- [ ] **[C/F]** Sign the firm's **mutual NDA** before any code is shared.
- [ ] **[I]** Agree start date + primary comms channel; name the [I] technical point of contact for the engagement.

## Phase 1 — Verify the immutable candidate

> All v0.6/v0.7 references are historical. The v0.8 candidate does not exist
> until the remediation is merged, CI is green, and a new immutable tag is
> created. Never move or reuse an audit tag; publish a new version if any
> reviewed source changes.

- [ ] **[I]** Confirm the 3 in-scope files are final for the v0.8 candidate:
      `contracts/contracts/{MultXBridge,MultXBridgeDest,WrappedLEP100}.sol`.
- [ ] **[I]** Verify the new v0.8 tag resolves to the recorded commit:
      ```bash
      git rev-list -n 1 REPLACE_WITH_V08_TAG
      ```
- [ ] **[I]** Compile with `solc 0.8.24`, optimizer runs `200`, and record fresh v0.8 artifact hashes. Final deployment still requires constructor-linked deployed-bytecode verification.
- [ ] **[I]** Publish the read-only v0.8 source snapshot and checksum at the new immutable tag.
      A private repository invite can still be provided if required by the
      selected firm.

## Phase 2 — Hand over the package

- [ ] **[I]** Deliver: threat model, triaged Slither report, Hardhat test suite
      (`contracts/test/`), Foundry invariant suite
      (`contracts/test/foundry/`), historical testnet deployment evidence
      (`contracts/deployments/`), the Fargate signer candidate
      (`docs/FARGATE_PRODUCTION_SIGNER_CANDIDATE.md`), signer source manifest
      (`docs/audit/AUDIT_SIGNER_SOURCE_MANIFEST_2026-08-19.md`), and signer
      operator runbook (`signer/OPERATOR_RUNBOOK.md`). VPS/mTLS material is
      rehearsal-only and is not the approved production architecture.
- [x] **[I]** Generate the **test-coverage report** (`cd contracts && npm run coverage`). The candidate has 88 passing Hardhat tests. Regenerate from the immutable tag when handing the package to the firm.

      | File | % Stmts | % Branch | % Funcs | % Lines |
      |---|---|---|---|---|
      | MultXBridge.sol | 84.91 | 58.33 | 69.23 | 83.10 |
      | MultXBridgeDest.sol | 98.18 | 87.50 | 84.62 | 98.57 |
      | WrappedLEP100.sol | 100 | 100 | 100 | 100 |
      | governance/GovTimelock.sol | 100 | 100 | 100 | 100 |

      ⚠️ **Known gap:** `MultXBridge.sol` branch coverage (58.33%) trails `MultXBridgeDest.sol`
      (87.50%) — the source-bridge test file predates the daily-cap/guardian hardening, so
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
- [ ] ✅ **Gate cleared** → proceed with a separately approved deployment of the audited bridge contracts and approved wrapped assets to LITHO, Ethereum, BNB and Base mainnets. Keep every feature disabled until the production canary passes.

---

**Bottleneck note:** Phase 0 is the only step gated on the client. Phases 1–2 are ~1 day of [I] work and can be staged in advance so the firm starts on day one.

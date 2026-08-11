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

## Phase 1 — Verify the immutable candidate

> The historical `9f939ab` and `audit-freeze-2026-07-14` references are
> superseded. The current published candidate is
> `multx-audit-candidate-v0.5.0-20260809`. It includes destination-chain and
> bridge domain binding plus OpenZeppelin low-s ECDSA recovery. Never move or
> reuse an audit tag; publish a new version if any reviewed source changes.

- [x] **[I]** Confirm the 3 in-scope files are final for this candidate:
      `contracts/contracts/{MultXBridge,MultXBridgeDest,WrappedLEP100}.sol`.
- [x] **[I]** Verify the tag resolves to the recorded commit:
      ```bash
      git rev-list -n 1 multx-audit-candidate-v0.5.0-20260809
      ```
- [x] **[I]** Compile with `solc 0.8.24`, optimizer runs `200`, and record the candidate artifact hashes in [`AUDIT_BYTECODE_HASHES_2026-08-09.md`](./AUDIT_BYTECODE_HASHES_2026-08-09.md). Final deployment still requires constructor-linked deployed-bytecode verification.
- [ ] **[I]** Share a read-only snapshot at the frozen commit (private repo invite **or** tarball — firm's preference).

## Phase 2 — Hand over the package

- [ ] **[I]** Deliver: threat model, triaged Slither report, Hardhat test suite (`contracts/test/`), Foundry invariant suite (`contracts/test/foundry/`), historical testnet deployment evidence (`contracts/deployments/`), VPS/KMS relay architecture (`docs/VPS_SIGNER_ARCHITECTURE.md`), and signer operator runbook (`signer/OPERATOR_RUNBOOK.md`). Historical KMS runbooks are not production instructions; the current Roles Anywhere package is authoritative.
- [x] **[I]** Generate the **test-coverage report** (`cd contracts && npm run coverage`). The candidate has 76 passing Hardhat tests. Regenerate from the immutable tag when handing the package to the firm.

      | File | % Stmts | % Branch | % Funcs | % Lines |
      |---|---|---|---|---|
      | MultXBridge.sol | 84.31 | 55.88 | 69.23 | 82.61 |
      | MultXBridgeDest.sol | 98.11 | 86.76 | 84.62 | 98.53 |
      | WrappedLEP100.sol | 100 | 100 | 100 | 100 |
      | governance/GovTimelock.sol | 100 | 100 | 100 | 100 |

      ⚠️ **Known gap:** `MultXBridge.sol` branch coverage (55.88%) trails `MultXBridgeDest.sol`
      (86.76%) — the source-bridge test file predates the daily-cap/guardian hardening, so
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

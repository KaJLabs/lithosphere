# Request for Quote — MultX Bridge Smart-Contract Audit

**Project:** Lithosphere — MultX cross-chain bridge
**Updated:** 2026-08-08
**Requested by:** Lithosphere infrastructure team (technical point of contact)
**Engagement type:** Fixed-scope, fixed-fee smart-contract security audit
**Sent to:** Trail of Bits · Spearbit (Cantina) · Halborn

---

## 1. Summary

We are seeking a fixed-fee security audit of the MultX bridge contracts ahead of
its mainnet launch — enabling real-asset transfers on Ethereum, BNB Chain, and
Base mainnet. The production source chain is LITHO mainnet (Cosmos
`lithosphere_9005-1`, EVM chain ID `9005`). MultX is disabled there. The
historical Kamet testnet deployment is retained only as test evidence. The
contract audit, remediation review, signer-protocol review and final deployment
approval are mandatory gates before mainnet contracts or real assets are enabled.

The scope is small and self-contained: **three Solidity files, approximately 557 LOC total**,
no external protocol composability, no upgradeable proxies. We have prepared a
full threat model and a triaged Slither report so the firm can move straight to
manual review.

---

## 2. Scope (what to audit / bill for)

| File | LOC | Role |
|---|---:|---|
| `contracts/contracts/MultXBridge.sol` | ~253 | Source-chain lock/release (LITHO) |
| `contracts/contracts/MultXBridgeDest.sol` | ~250 | Dest-chain burn/mint (Ethereum, BNB, Base) |
| `contracts/contracts/WrappedLEP100.sol` | 54 | Wrapped-asset ERC20 on dest chains |
| **Total** | **~557** | |

- **Solidity:** `0.8.24`, optimizer runs = 200
- **Dependencies:** OpenZeppelin Contracts (Pausable, ReentrancyGuard,
  AccessControl, SafeERC20, ERC20Burnable) — assume sound (T6); do not re-audit.
- **Frozen commit:** the new immutable audit-candidate tag will be created only
  after destination-domain tests and all PR checks pass. Earlier freeze tags are
  historical and must not be audited for LITHO mainnet deployment.

### Explicitly OUT of scope (do not bill)

- `LEP100Token.sol` (canonical tokens, already deployed, standard ERC20)
- `contracts/dex/` (Uniswap v3 fork) and `contracts/dnns/` (ENS fork) — separate scope
- `bridge-api/` off-chain validator service — assess via separate ops review if desired
- Faucet contracts/scripts; `kamet-explorer` frontend
- VPS hardening, PKI, networking and monitoring infrastructure (separate ops review)

---

## 3. Architecture (one paragraph)

MultX is an N-of-M validator-multisig lock/mint bridge. On the source chain a
user calls `lockTokens`, which escrows (Kamet) or burns (dest) the asset and
emits `TokensLocked` with a monotonic nonce. A set of **7 validators
(5-of-7 threshold)** runs on independently operated VPSs. Each rootless signer
authenticates the coordinator with TLS 1.3 mTLS, independently verifies the
source event and route policy, journals its decision to prevent equivocation,
and produces an ECDSA signature. Anyone can submit
the 5+ ordered signatures to `releaseTokens` on the destination chain, which
verifies the validator set, checks `processedNonces` for replay, enforces a
per-token daily cap, and releases (mints/transfers) to the recipient. Admin
functions (`pause`, `setValidatorSet`, `setDailyCap`, `addSupportedToken`) are
owner-gated. Full detail in the threat model (attached).

---

## 4. What we are providing at kickoff

1. `docs/audit/MULTX_THREAT_MODEL.md` — system overview, trust assumptions (T1–T7),
   adversary models, asset-flow invariants, known limitations (L1–L7), and 5
   specific open questions we want opined on.
2. `docs/audit/slither-pre.txt` — Slither 0.11.5 report over all 3 contracts,
   with our triage of every finding.
3. Hardhat test suite: `contracts/test/{MultXBridge,MultXBridgeDest,WrappedLEP100}.test.js`
   (72 passing) **plus a Foundry invariant suite** (`contracts/test/foundry/`, 12
   invariants across both bridges — solvency/backing, no-double-release, daily-cap,
   nonce-monotonicity, threshold well-formedness — each mutation-validated and run
   in CI). Directly addresses several §5 questions with executable properties.
4. Deployment scripts and the current Kamet (testnet) deployment record.
5. VPS signer implementation and architecture: `signer/`,
   `api/src/services/remoteSigner.js`, and `docs/VPS_SIGNER_ARCHITECTURE.md`.
6. Operator runbooks and a dedicated technical point of contact for the duration.

The Solidity review remains the fixed approximately 557-LOC scope. Please quote the off-chain
signer protocol review separately so its source-event verification, message
construction, mTLS boundary and anti-equivocation behavior are explicitly covered.

---

## 5. What we are asking the firm to opine on

Beyond a standard full-coverage review, we specifically want findings on:

1. **Signature scheme** — confirm the `eth_sign`-style prefixed hash, including
   destination chain ID and bridge address, plus ordered-signer enforcement is
   robust against malleability and cross-domain replay. Should we still move to EIP-712?
2. **Daily-cap boundary** — any day-boundary / `block.timestamp` edge cases?
3. **Pause semantics on `releaseTokens`** — mid-execution behavior when paused.
4. **Validator-set rotation** — `setValidatorSet` invalidates in-flight signatures
   from the old set; is a grace period warranted?
5. **`WrappedLEP100` mint authority** — is `BRIDGE_ROLE`-only mint sufficient, or
   should the wrapper carry its own pause?

We also want L1 (single-EOA owner → recommend Gnosis Safe) explicitly graded as
to whether it is REQUIRED-BEFORE-MAINNET in the firm's opinion.

---

## 6. Please quote

Please reply with:

| Field | |
|---|---|
| **Fixed fee** (USD) | for the scope in §2 |
| **Lead time** | earliest start date |
| **Duration** | calendar days / auditor-weeks |
| **Team** | number + seniority of auditors assigned |
| **Deliverable** | report format; does it include a remediation-review round? |
| **Re-audit** | cost/terms for re-review after we fix findings |
| **Methodology** | manual + tooling; any fuzzing/formal (Echidna/Foundry/Halmos)? |
| **Public report** | can the final report be published? (we intend to) |

Target window: we'd like to **start within 2–4 weeks** and have a draft report
within the firm's standard turnaround for a ~530-LOC scope.

---

## 7. Logistics

- Code will be shared as a read-only Git repository snapshot at the frozen commit
  (private repo invite or tarball — firm's preference).
- The vendor contract and payment are handled directly by the Lithosphere client;
  the infra team is the technical contact only.
- NDA: we can sign the firm's standard mutual NDA before code share.

**Reply to:** *(Lithosphere project channel — infra team)*

---

*Attachments: MULTX_THREAT_MODEL.md, slither-pre.txt*

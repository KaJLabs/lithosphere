# Request for Quote — MultX Bridge Smart-Contract Audit

> **Superseded historical intake (do not send as the v0.8 package).** Autha's
> v0.7.0 report is NOT READY FOR MAINNET. Use
> `AUTHA_V070_REMEDIATION_2026-08-21.md` and the new immutable v0.8 bundle only
> after merge, green CI and tagging.

**Project:** Lithosphere — MultX cross-chain bridge
**Updated:** 2026-08-19
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

The scope is small and self-contained: **three Solidity files, 382 code lines
(681 physical lines including NatSpec/comments) total**,
no external protocol composability, no upgradeable proxies. We have prepared a
full threat model and a triaged Slither report so the firm can move straight to
manual review.

---

## 2. Scope (what to audit / bill for)

| File | Code lines | Physical lines | Role |
|---|---:|---:|---|
| `contracts/contracts/MultXBridge.sol` | 177 | 316 | Source-chain lock/release (LITHO) |
| `contracts/contracts/MultXBridgeDest.sol` | 170 | 311 | Dest-chain burn/mint (Ethereum, BNB, Base) |
| `contracts/contracts/WrappedLEP100.sol` | 35 | 54 | Wrapped-asset ERC20 on destination chains |
| **Total** | **382** | **681** | |

- **Solidity:** `0.8.24`, optimizer runs = 200
- **Dependencies:** OpenZeppelin Contracts (Pausable, ReentrancyGuard,
  SafeERC20, ERC20Burnable) — assume sound (T6); do not re-audit.
- **Previous frozen candidate:** `multx-audit-candidate-v0.6.0-20260819`.
  Autha's v0.5 findings require a new immutable post-remediation tag after CI
  and merge; do not review an unfrozen branch tip. Earlier freeze tags are
  historical and must not be approved for LITHO mainnet deployment. If the
  reviewed source changes, KaJ Labs will publish a new immutable version rather
  than moving this tag.

### Explicitly OUT of scope (do not bill)

- `LEP100Token.sol` (canonical tokens, already deployed, standard ERC20)
- `contracts/dex/` (Uniswap v3 fork) and `contracts/dnns/` (ENS fork) — separate scope
- General `api/` business logic beyond the two coordinator integration files
  explicitly listed in section 4
- Faucet contracts/scripts; `kamet-explorer` frontend
- AWS account configuration, VPC/ALB hardening, ECS operations and monitoring
  infrastructure (separate cloud-operations review)

---

## 3. Architecture (one paragraph)

MultX is an N-of-M validator-multisig lock/mint bridge. On the source chain a
user calls `lockTokens`, which escrows the source asset or burns a destination
wrapped asset and
emits `TokensLocked` with a monotonic nonce. A set of **7 bridge signers
(5-of-7 threshold)** runs as seven isolated AWS Fargate services. Each signer
uses a unique non-exportable KMS secp256k1 key, DynamoDB decision journal,
private HTTPS endpoint and bearer token. It independently verifies the source
event and route policy before producing an ECDSA signature. Anyone can submit
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
   (88 passing) **plus a Foundry invariant suite** (`contracts/test/foundry/`, 12
   invariants across both bridges — solvency/backing, no-double-release, daily-cap,
   nonce-monotonicity, threshold well-formedness — each mutation-validated and run
   in CI). Directly addresses several §5 questions with executable properties.
4. Deployment scripts and the current Kamet (testnet) deployment record.
5. Fargate/KMS signer implementation and architecture: `signer/`,
   `api/src/services/{remoteSigner,validatorService}.js`,
   `docs/FARGATE_PRODUCTION_SIGNER_CANDIDATE.md`, and
   `docs/audit/AUDIT_SIGNER_SOURCE_MANIFEST_2026-08-19.md`.
6. Operator runbooks and a dedicated technical point of contact for the duration.

The Solidity review remains the fixed three-file, 382-code-line scope. Please quote the off-chain
signer protocol review separately so its source-event verification, message
construction, private HTTPS/bearer boundary, KMS signing and DynamoDB
anti-equivocation behavior are explicitly covered.

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
5. **`WrappedLEP100` mint authority** — confirm the immutable bridge-only minter
   closes Autha C-01 and cannot be replaced by an administrator.

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
within the firm's standard turnaround for the 382-code-line Solidity scope.

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

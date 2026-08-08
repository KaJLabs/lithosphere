# MultX Bridge — Threat Model

> **Current architecture notice (2026-08-08):** LITHO mainnet uses Cosmos ID
> `lithosphere_9005-1` and EVM chain ID `9005`. MultX remains disabled. The
> production candidate replaces centralized AWS KMS signing with independent,
> rootless VPS signer services using TLS 1.3 mTLS, source-event verification,
> route policies, and fsync-backed anti-equivocation journals. The contracts
> and this off-chain signer protocol require independent review before MultX
> can be enabled. Historical Kamet deployment details remain for provenance.

**Last reviewed:** 2026-08-08
**Audience:** External security audit firm + internal review
**Repo:** `KaJLabs/Lithosphere` (`MultX/contracts/contracts/MultXBridge.sol`)
**Companion docs:**
- Slither pre-audit report: [`slither-pre.txt`](./slither-pre.txt)
- Current (Kamet testnet) deployment: [`contracts/deployments/kamet-bridge-hardened-2026-05-09T18-03-58-093Z.json`](../../contracts/deployments/)

---

## 1. System Overview

MultX is an N-of-M signature bridge between Lithosphere Kamet (source / canonical chain, EVM `900523`) and three EVM destination chains (Ethereum mainnet, BNB Chain mainnet, Base mainnet — testnet equivalents live in this branch).

### 1.1 Forward flow (Kamet → dest chain)

```
User                  MultXBridge (Kamet)         Validator service        MultXBridge (dest)
 │                          │                            │                         │
 │  approve(bridge, amt)    │                            │                         │
 │ ───────────────────────► │                            │                         │
 │                          │                            │                         │
 │  lockTokens(token, amt,  │                            │                         │
 │  targetChain)            │                            │                         │
 │ ───────────────────────► │                            │                         │
 │                          │ TokensLocked event         │                         │
 │                          │ ──────────────────────────►│                         │
 │                          │                            │ sign(keccak(...))       │
 │                          │                            │ ×N validators           │
 │                          │                            │                         │
 │                          │                            │ submit sigs to dest     │
 │                          │                            │ ───────────────────────►│
 │                          │                            │                         │ releaseTokens(...)
 │                          │                            │                         │ → mint wrapped
 │ ◄──────────────────────────────────────────────────────────────────────────────│
 │  user receives wrapped LEP100 on dest chain                                    │
```

### 1.2 Reverse flow (dest chain → Kamet)

```
User                  MultXBridge (dest)         Validator service       MultXBridge (Kamet)
 │  approve(bridge, amt)    │                            │                         │
 │ ───────────────────────► │                            │                         │
 │                          │                            │                         │
 │  lockTokens(wrapped,     │                            │                         │
 │  amt, 900523)            │                            │                         │
 │ ───────────────────────► │                            │                         │
 │                          │ TokensLocked event         │                         │
 │                          │ ──────────────────────────►│                         │
 │                          │                            │ sign(..., source=dest)  │
 │                          │                            │                         │
 │                          │                            │ submit sigs to Kamet    │
 │                          │                            │ ───────────────────────►│
 │                          │                            │                         │ releaseTokens(...)
 │ ◄──────────────────────────────────────────────────────────────────────────────│
 │  user receives original LEP100 back on Kamet                                   │
```

### 1.3 Contracts in scope

| Contract | LOC | Purpose | Storage |
|---|---:|---|---|
| `MultXBridge.sol` | 241 | Source-chain lock + release (Kamet) | nonce, validators[], supportedTokens, processedNonces, dailyCap/dailyVolume/lastCapReset, Pausable._paused |
| `MultXBridgeDest.sol` | 238 | Dest-chain lock(burn) + release(mint) (Ethereum/BNB/Base) | same layout as `MultXBridge`, but `lockTokens` burns the wrapped token via `burnFrom` and `releaseTokens` mints via `bridgeMint` |
| `WrappedLEP100.sol` | 54 | Wrapped representation on dest chains | OZ ERC20 + ERC20Burnable + AccessControl with `BRIDGE_ROLE` |

### 1.4 Contracts out of scope (don't audit, don't bill)

- `LEP100Token.sol` — canonical LEP100 tokens on Kamet. Already deployed, immutable. Standard ERC20.
- DEX contracts (`contracts/dex/`) — Uniswap v3 fork, separately auditable; not part of bridge surface area.
- DNNS contracts (`contracts/dnns/`) — ENS fork; not part of bridge surface area.
- Faucet contracts — internal-only testnet helper.

---

## 2. Trust Assumptions

| # | Assumption | What we mitigate / accept |
|---|---|---|
| T1 | Validator key custody is secure | Each independent operator runs one rootless VPS signer. The API holds no validator private keys. Keys are mounted from operator-controlled encrypted storage; TLS 1.3 mTLS authenticates API-to-signer traffic. Review `MultX/signer/`, `api/src/services/remoteSigner.js`, and the operator controls in `docs/VPS_SIGNER_ARCHITECTURE.md`. |
| T2 | At least `signaturesRequired` validators (live: **5 of 7**) act honestly | This is the core security assumption. Any N out of M collusion can mint arbitrary wrapped tokens (limit: total locked on source). |
| T3 | The Kamet chain itself is not 51%-attacked | Bridge security inherits chain security. Kamet runs CometBFT BFT consensus with the existing validator set (separate from bridge validators). |
| T4 | Dest-chain RPC providers return honest state to validators | Mitigation: each validator runs its own RPC client; majority-truth via N-of-M signing already guards against a single bad RPC. |
| T5 | Compiler (`solc 0.8.24` with optimizer runs=200) is sound | Standard assumption; well-known compiler, widely used. |
| T6 | OpenZeppelin contracts (Pausable, ReentrancyGuard, AccessControl, SafeERC20, ERC20Burnable) are sound | OZ audited and battle-tested. |
| T7 | The owner key (setValidatorSet/setDailyCap/addSupportedToken/unpause) is custodied securely | Target: **owner = TimelockController (48h) governed by an M-of-N Gnosis Safe** (ADR-0004), with a separate fast `pauseGuardian`. Built + tested; live transfer scheduled for production cutover (client decision — see L1). Until then the live owner is the deployer EOA. |

---

## 3. Adversary Models

### 3.1 Malicious validator subset (size < signaturesRequired)

**Capability:** sign attestations, withhold attestations, sign equivocating attestations.

**Impact:** None directly — under the N-of-M threshold, no minting/release possible. Their signatures contribute to nothing on their own.

**Mitigation:** N-of-M threshold + ordering check (`signer > lastSigner` in `releaseTokens`) prevents the same key being counted twice.

### 3.2 Malicious validator subset (size ≥ signaturesRequired)

**Capability:** sign release of arbitrary amounts of wrapped tokens on dest chains without a corresponding lock on Kamet (or vice versa).

**Impact:** Can mint up to the total user-supplied liquidity locked on the source chain (worst case: drain all locked LEP100). Cannot mint beyond what's been locked because the dest-chain `releaseTokens` is also one-way (it just transfers from the bridge's own balance).

Actually — on dest chains, `releaseTokens` calls `IERC20(token).safeTransfer(user, amount)`, which transfers from the bridge's own balance of wrapped tokens. **The bridge's balance is its mint authority via `BRIDGE_ROLE`**, so a colluding majority can mint arbitrarily.

**This is the core trust boundary.** Mitigated only by:
- Validator set composition (independent operators, ideally not all under one legal/operational entity)
- Independent VPS operators, encrypted key custody, mTLS and signer-local policy checks making a quorum compromise materially harder
- Daily caps (`dailyCap[token]`) — limits damage of a single-day rogue release
- Emergency pause — owner can halt all bridge operations within one block of detection

### 3.3 Malicious user / external attacker

**Capability:** call any external function, submit any calldata, replay-attack with old signatures, race-condition exploits.

**Specific attempted attacks and current defenses:**

| Attack | Defense |
|---|---|
| Re-use signed release for the same source nonce twice | `processedNonces[sourceChain][sourceNonce]` set to true on first execution; subsequent calls revert |
| Submit duplicate signatures to inflate count | Signature ordering check: `require(signer > lastSigner, "Signatures must be in ascending order")` |
| Submit signatures from unknown signer | `require(isValidator[signer], "Invalid signer")` |
| Reentrancy on `releaseTokens` (try to recurse during `safeTransfer`) | `nonReentrant` modifier from OZ ReentrancyGuard |
| Lock 0 amount to create spam events | `require(amount > 0, "Amount must be greater than 0")` |
| Lock to current chain (no-op bridge) | `require(targetChain != block.chainid)` |
| Bridge unsupported token | `require(supportedTokens[token], "Token not supported")` |
| Exceed daily cap | Per-token rolling 24h window + `require(dailyVolume + amount <= dailyCap)` (when cap > 0) |
| Front-run an in-flight signature submission | Signatures are over `(sourceTxHash, token, user, amount, sourceChain, sourceNonce)` — no malleability the recipient can exploit |
| Inflate cap by waiting just under 24h then bursting | `lastCapReset` is reset only when 24h has passed; a 23h59m burst still counts against the cap |

### 3.4 Malicious bridge owner

**Capability:** pause bridge, change validator set, raise/lower caps, add/remove tokens.

**Impact:** Can halt all bridge operations (pause), can replace validators with attacker-controlled keys (then drain via T2.2), can raise daily caps to enable a single-day drain.

**Mitigation:** owner becomes a Safe→Timelock(48h) at production cutover; guardian (pause-only) already in code. Currently a single deployer key on the live bridge — **see L1 below** (mitigation built, transfer deferred to production per client).

### 3.5 Compromised RPC provider used by validator service

**Capability:** lie to a single validator about chain state.

**Impact:** that validator either signs an invalid attestation (caught by other validators refusing) or fails to sign valid attestations (degrades signing throughput but doesn't break safety).

**Mitigation:** each validator should run its own independent RPC. Audit firm: please verify the validator deploy guide mandates separate RPC providers per validator.

---

## 4. Asset Flow Invariants

For each LEP100 token `T` and each chain pair (Kamet, dest):

1. **Conservation (steady state):**
   ```
   sum(T balance of Kamet bridge) >= sum(T minted on dest) - sum(T burned on dest)
   ```
   Or in plain terms: tokens locked on Kamet must always cover tokens currently minted on the dest chain. If users have wrapped tokens on a dest chain, the original tokens on Kamet should be held by the bridge contract.

2. **Nonce monotonicity:** `nonce` strictly increases per chain. `processedNonces[srcChain][srcNonce]` is one-way (false → true, never reverted).

3. **Signature attribution:** every release event is attributable to exactly the validators whose signatures the call provided.

4. **No partial reverts:** all state changes in `lockTokens` and `releaseTokens` either fully apply or fully revert (covered by ReentrancyGuard + Solidity's atomicity).

5. **Pausable atomicity:** `pause()` blocks any new `lockTokens` / `releaseTokens` until `unpause()`. Already in-flight transactions on chain still complete (no force-revert), but no NEW txs can be initiated.

### Invariant testing recommendation

Audit firm: please test these with Foundry / Echidna invariant tests. Suggested invariants for the testing harness:

```solidity
// Echidna-style invariants
function invariant_no_double_release() public view {
  for (each sourceChain, sourceNonce) {
    assert(processedNonces[sourceChain][sourceNonce] == true || release_for_that_nonce_count == 0);
  }
}

function invariant_signer_ordering() public {
  // Crafted release with duplicate sig should always revert
}

function invariant_pause_blocks_lock() public {
  pause();
  vm.expectRevert();
  lockTokens(...);
}
```

---

## 5. Known Limitations (accepted for v1 — flagged for audit attention)

| # | Limitation | Why accepted for v1 | Plan for v2 |
|---|---|---|---|
| L1 | Owner is a single EOA, not a multisig — **MITIGATION BUILT, transfer deferred to production** | The Safe + TimelockController(48h) + guardian design is implemented and tested (`Governance.integration.test.js`), and the migration tooling is ready. Per client decision (2026-06-20), the **live** Kamet bridge stays under the deployer EOA through audit/testnet (test wallets used for rehearsal); ownership is transferred to the client-held M-of-N Safe at production cutover (M4.6). See ADR-0004 + `docs/operations/GOVERNANCE_MIGRATION.md`. | Execute live ownership transfer at production cutover |
| L2 | No economic slashing of misbehaving validators | Out of scope for v1; bridge can rotate via `setValidatorSet` instead | Optional: stake LITHO via separate contract that can slash on equivocation proof |
| L3 | Validator service uses one signature coordinator (`MultX/api`), not a P2P mesh | The coordinator cannot forge signatures and each signer independently validates the source event, confirmations, bridge and route. A coordinator outage can halt transfers, but cannot satisfy the quorum. | Add redundant coordinators or P2P aggregation if availability requires it |
| L4 | **Required before mainnet:** the signed hash does not bind the destination chain or destination bridge | `processedNonces[sourceChain][sourceNonce]` is local to each bridge contract. If two destination contracts share a validator set and release-token address, one valid signature quorum can be replayed on both. Add destination-domain binding (preferably EIP-712), migration tests and independent review before deployment. |
| L5 | `block.timestamp` used for daily cap reset | Acceptable: 24-hour window cannot be meaningfully manipulated by ±15s block-time drift | None |
| L6 | Pause guardian == owner — **RESOLVED in code** | Dedicated `pauseGuardian` role added: a fast ops key can `pause()` without holding owner rights; `unpause()`/config stay owner-only. Proven in `contracts/test/Governance.integration.test.js`. The live `pauseGuardian` is assigned during the governance wiring at production cutover (address(0) until then → pause is owner-only, as today). | Assign guardian at cutover |
| L7 | No on-chain `setSignaturesRequired` independent of `setValidatorSet` | `setValidatorSet` always takes both; intentional to prevent inconsistent state | None |

---

## 6. Out-of-scope items the audit shouldn't bill for

To keep the audit scoped tightly and the fee predictable:

- **Uniswap v3 fork** in `contracts/dex/` — separate audit scope if/when needed
- **ENS fork (DNNS)** in `contracts/dnns/` — separate audit scope if/when needed
- **Faucet** scripts and contracts — testnet helper only, doesn't hold mainnet funds
- **Indexer + bridge-api business logic** in `bridge-api/` — not on-chain code; assess via separate ops security review
- **Validator signer infrastructure** (VPS hardening, mTLS PKI, backups, monitoring) — separate ops review; the signing protocol itself still requires application-security review
- **Frontend** (`kamet-explorer`) — not security-critical; users can always interact directly with the contract

---

## 7. Open questions for the audit firm

We'd like the audit to specifically opine on:

1. **Signature scheme:** is the current `keccak256("\x19Ethereum Signed Message:\n32", msgHash)` recovery + ordered-signer pattern robust against all known signature malleability? Should we move to EIP-712 typed structured data signing?
2. **Cap semantics:** is the daily cap reset logic safe against day-boundary edge cases (e.g., timestamp manipulation by a malicious validator on Kamet — though that would require 51% control of Kamet, see T3)?
3. **Pause behavior on `releaseTokens`:** if a release is mid-execution when pause is called, does it complete? Should it?
4. **Validator set rotation:** when `setValidatorSet` is called, any release tx not yet executed will reject signatures from the old set. Is this the desired behavior, or should there be a grace period? Recommend documenting this in operator runbook.
5. **Dest-chain wrapped token (`WrappedLEP100`):** is the `BRIDGE_ROLE`-only mint pattern sufficient, or should we add explicit `pause` on the wrapper too?

---

## 8. Deployment & operational context

### Current deployment (Kamet testnet — mainnet launch pending this audit)

- Contract: `0x3a896BDF3a1088287FA84aB5a43bB30e2535F263` (live on Kamet, chainId 900523, **testnet**)
- Deployed: 2026-05-09 (hardened version with Pausable, setValidatorSet, daily caps)
- Owner: deployer EOA `0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF` (unchanged). The Safe + Timelock(48h) + guardian migration is built and tested; per client decision (2026-06-20) the live ownership transfer to the client-held M-of-N Safe happens at **production cutover** — test wallets are used for any pre-production rehearsal. The guarded contract (with `pauseGuardian`) is what the audit reviews and what deploys at cutover.
- Validators (7, **5-of-7 threshold**, migrated 2026-05-19 via atomic pause -> setValidatorSet -> unpause; no in-flight tx affected):
  - `#0 0xD9B30A7f4d58f1b98AaA69B82F0c8bF0816638FB`
  - `#1 0xEefB2E0c91Bc57975D117BADA6c70f3Cd6C4bC91`
  - `#2 0x4dFEd8e8359EaA711CdFFFcb5d994a66e46185Ac`
  - `#3 0x27026F8C232d723100700186c10B2aEbd82ea60C`
  - `#4 0xc8C5c89ddb70CAEC942f2C5A77F4F4001ef3B415`
  - `#5 0x4CDd6D160Bd79fe7d4Bab06a9E0607870e8108D9`
  - `#6 0xB161611185Ce2c95849134188AC9F5DbC26bfD2D`
- Validator keys: the Kamet deployment historically used AWS KMS. The LITHO
  mainnet candidate does not use AWS. It requires independently operated VPS
  signers and mounted operator-controlled key files. Production rejects local
  validator keys in the API process. No LITHO mainnet signer set is active yet.

### Operational runbooks supplied to audit firm

- `docs/operations/BRIDGE_RUNBOOK.md` — pause procedure, validator-set rotation, daily-cap management, incident-response playbook (key compromise / suspected contract bug / RPC brownout)
- `docs/VPS_SIGNER_ARCHITECTURE.md` — current signer trust boundaries and launch gates
- `docs/operations/VALIDATOR_KEY_ROTATION.md` — historical KMS procedures; must not be used for the VPS-only LITHO mainnet deployment

---

## 9. Submission package checklist

Items the audit firm should expect at kickoff:

- [x] Contract source code (`contracts/contracts/MultXBridge.sol`, `MultXBridgeDest.sol`, `WrappedLEP100.sol`)
- [x] This threat model document
- [x] Slither pre-audit report (`slither-pre.txt`) — refreshed 2026-05-21 over all three in-scope contracts
- [x] Git commit hash of frozen code (`9f939ab8501bd351024ffc7ca5e884a3090c3ecc`; firms re-confirm at kickoff)
- [x] Hardhat test suite (`contracts/test/MultXBridge.test.js`, `MultXBridgeDest.test.js`, `WrappedLEP100.test.js`)
- [x] Deployment scripts (`contracts/scripts/02-redeploy-bridge-hardened.js`, `03-deploy-dest-chain.js`)
- [x] Operator runbooks (`docs/operations/BRIDGE_RUNBOOK.md`, `VALIDATOR_KEY_ROTATION.md`)
- [x] VPS signer reference implementation and architecture document
- [ ] Independent review of the VPS signer protocol, mTLS deployment and operator key-custody procedure
- [x] Foundry invariant suite (`contracts/test/foundry/MultXBridgeInvariant.t.sol`) — solvency / release≤lock / nonce / threshold invariants over 16,384 fuzzed calls

---

*End of threat model. Questions / clarifications: contact infra team via the Litho project channel.*

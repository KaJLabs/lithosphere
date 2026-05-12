# Contract deployment runbook

> Last reviewed: 2026-05-12 · Owner: Dev Infra + Validator Team · Linked phase: P7

How production contracts get to chain. Three flows, ordered from least
to most authoritative:

1. **Local devnet / staging** — `pnpm hardhat run scripts/deploy.ts` with an
   EOA private key. Fine for iteration; never for mainnet.
2. **Multi-sig deployment** — Safe `{N of M}` signing flow. Required for
   any production-state-changing deploy.
3. **Ledger-signed multi-sig** — same as #2 but each signer uses a hardware
   wallet. Required for mainnet once we have one.

The compilation, ABI vendoring, and post-deploy verification are
**identical across all three flows**. What changes is who/how the
transaction gets signed.

---

## 1. Local / staging (EOA)

```bash
cd Makalu/contracts
# Set a funded deployer key in .env (NEVER use this for production).
export DEPLOYER_PRIVATE_KEY=0x...
# Add the target network to hardhat.config.ts if not present.
pnpm hardhat run scripts/deploy.ts --network <name>
```

The script emits `deployments/<chainId>.json`:

```json
{
  "chainId": 700777,
  "network": "makalu",
  "deployer": "0xabc...",
  "commit": "3a14b0e...",
  "deployedAt": "2026-05-12T15:30:00.000Z",
  "contracts": [
    { "name": "LITHONative", "address": "0x...", "txHash": "0x...", "blockNumber": 12345 },
    { "name": "WLITHO",      "address": "0x...", "txHash": "0x...", "blockNumber": 12346 }
  ]
}
```

Then verify on-chain bytecode matches the compiled artifact:

```bash
pnpm hardhat run scripts/verify-deployment.ts --network <name>
```

Commit the manifest. The SDK's `NETWORKS` table consumes it (open work:
auto-wire — today the addresses are hand-edited in
`Makalu/packages/blockchain-core`).

---

## 2. Multi-sig deployment (Safe)

Required for any contract that holds funds, mints tokens, or has admin
roles on production state. The flow:

### Pre-flight (Dev Infra)

1. Verify the contract compiles cleanly with the exact commit you intend
   to deploy:
   ```bash
   cd Makalu/contracts
   pnpm clean && pnpm compile && pnpm test
   pnpm forge-test:ci   # property-based fuzz coverage
   ```
2. Confirm Slither's `slither-production` job in `ci-contracts.yaml` is
   green on the same commit. Production Slither is blocking
   (`fail_on: high`), so a green CI run = no HIGH static findings.
3. Compute the **creation bytecode + constructor args** that the Safe
   will execute. Use Hardhat's `artifacts.readArtifact(name).bytecode`
   plus `ethers.AbiCoder.defaultAbiCoder().encode(['address'], [...])`
   for the constructor.

### Safe transaction proposal

The Safe address for production deploys is documented in
`docs/network/network-parameters.json` (`governance.deploySafe`). To
propose:

1. Open the [Safe app](https://app.safe.global) on the target network.
2. **New Transaction → Contract Interaction → Custom data**.
3. **To**: leave empty (contract creation).
4. **Data**: paste the creation bytecode + ABI-encoded constructor args
   from step 3 above.
5. **Value**: 0 unless the constructor is payable.
6. Set a descriptive nonce reservation comment in the Safe UI: include
   the git commit short SHA and the contract name. This makes the Safe
   activity log auditable from git history.
7. Submit. The transaction now sits at status "Awaiting confirmations"
   until the {N of M} threshold signs.

### Signing

Each multi-sig signer:

1. Opens the proposed transaction in the Safe app.
2. **Verifies the bytecode + constructor args match** what Dev Infra
   distributed in the proposal message. Sign-blind is forbidden —
   even a one-character bytecode difference can be a logic bomb.
3. Connects their signing wallet (MetaMask for non-prod; Ledger for
   prod — see §3).
4. Clicks Confirm. The signature is collected by the Safe service.

### Execution

Once threshold is met, any signer can click **Execute**. The
contract-creation transaction lands on chain. Note the deployment block
number and tx hash for the post-deploy manifest.

### Post-deploy (Dev Infra)

1. Reproduce the deployment manifest manually because `scripts/deploy.ts`
   wasn't the path the contract took:
   ```bash
   # Edit deployments/<chainId>.json:
   {
     "chainId": 700777,
     "network": "makalu",
     "deployer": "<SAFE_ADDRESS>",
     "commit": "<EXACT_SHA_THAT_WAS_DEPLOYED>",
     "deployedAt": "<ISO_TIMESTAMP>",
     "contracts": [
       { "name": "...", "address": "<NEW_ADDRESS>",
         "txHash": "<SAFE_EXECUTION_TX>", "blockNumber": <N> }
     ]
   }
   ```
2. Run `verify-deployment.ts` against the manifest. **This is the
   non-negotiable gate** — if on-chain bytecode doesn't match the
   compiled artifact, something between propose and execute went wrong.
   Halt and investigate before announcing the deploy.
3. Open a PR adding the manifest + any SDK address-table updates.
   Include the Safe transaction URL in the PR body.

---

## 3. Ledger-signed multi-sig (mainnet)

Same as §2 with one change: each signer's wallet must be a Ledger
hardware device, not a software wallet. Required for **every** signer
in the {N of M} once a Lithosphere mainnet exists; staging-Safe signers
may use software wallets during dry-runs.

Per-signer setup:

1. Install the Ledger Live app + Ethereum app on the device.
2. Open the Safe app in the browser.
3. Connect with **Ledger** as the wallet (not WalletConnect or MetaMask).
4. **Enable "Contract data" in the Ethereum app settings** on the
   Ledger device. Without it, Ledger refuses to sign any contract
   interaction (which is most Safe transactions).
5. Verify on the Ledger device screen: every signature prompt shows the
   target contract, the function selector, and the calldata. Compare
   to what Dev Infra distributed before pressing the right-side button.

Signing without verifying-on-device is the same class of failure as
signing-blind on the laptop. The hardware device is a final check, not
a rubber stamp.

---

## Etherscan verification (optional)

Once Lithosphere has a public block explorer that supports Sourcify or
Etherscan-style verification, add this to the post-deploy step:

```bash
pnpm hardhat verify --network <name> <ADDRESS> "<constructor-arg-1>" "<constructor-arg-2>"
```

The verifier reads `solidity.version` + `optimizer.runs` from
`hardhat.config.ts` and rebuilds the source from the linked GitHub
repo. Currently a no-op for Makalu (no Etherscan-style verifier wired);
revisit when the explorer adds one.

---

## Anti-checklist (do NOT do)

- ❌ Deploy from an EOA on mainnet, even if the EOA is "controlled by the team"
- ❌ Sign a Safe tx without diffing the bytecode against your local compile
- ❌ Skip `verify-deployment.ts` because "the addresses look right"
- ❌ Forget to commit `deployments/<chainId>.json` — downstream tooling assumes it's checked in
- ❌ Use `--no-verify` on the deploy commit to skip pre-commit hooks
- ❌ Edit a deployed contract's source code without redeploying first
  (the on-chain bytecode and the source on `main` diverge silently)

---

## Cross-references

- `supply-chain.md` — image signing, SLSA L2; same discipline applied to
  the container layer rather than contract bytecode
- `key-rotation-runbook.md` — what to do when a multi-sig signer rotates
- `cab.md` — when a contract deploy needs CAB approval (any prod-state
  change does)
- `Makalu/contracts/.slither.config.json` — `fail_on: high` lock the
  static-analyzer gate
- `Makalu/contracts/foundry.toml` — `[profile.ci]` with 10k fuzz runs
  per property — the property-based safety net

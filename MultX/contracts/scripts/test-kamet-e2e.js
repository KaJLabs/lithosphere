/**
 * End-to-end test: Kamet EVM txns, token transfers, and bridge lock flow
 */
const hre = require("hardhat");
const fs = require("fs");

const BRIDGE = "0x95B646bF6629A379AD898DC58D011fd3111e5700";
const TOKENS = {
  wLITHO: "0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2",
  LitBTC:  "0x12C9d1358edb0DBe13E2B8817B3c32899C2C75bE",
  LAX:     "0x508a1cB83949C9E0EB5FE698d11438EF55bFb5E1",
  JOT:     "0xED604cCD5F6097f3459b1D550133Bb50e79E3BAA",
  COLLE:   "0xCD9E54Ff1628AAB482376B853667f47E72c2a71c",
  IMAGE:   "0x85ce74df843bD0b8396Ecf67bDc4F88e6C1d3d58",
  AGII:    "0x4347C4D6A34e278df8414510e7920aED21563C9e",
  BLDR:    "0xc7321D4F577eF95CdBEAE2CFbA8db67B96c02B7a",
  FGPT:    "0x682575D03D3DbC7eB2e2cc0FbCb0DDEf9a1CC220",
  MUSA:    "0x882651F5C1308AE04549C5A3fE4DF67EAA9465f9",
};
const TARGET_CHAIN_SEPOLIA = 11155111;
const TEST_RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // hardhat account 1

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const BRIDGE_ABI = [
  "function lockTokens(address token, uint256 amount, uint256 targetChain)",
  "function nonce() view returns (uint256)",
  "function getValidators() view returns (address[])",
  "function signaturesRequired() view returns (uint256)",
  "function supportedTokens(address) view returns (bool)",
  "event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 targetChain, uint256 nonce)",
];

let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, err) { failed++; console.log(`  ❌ ${name}: ${err}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const provider = deployer.provider;
  const network = await provider.getNetwork();

  console.log("=".repeat(60));
  console.log("  KAMET END-TO-END TEST SUITE");
  console.log("=".repeat(60));
  console.log(`  Chain ID: ${network.chainId}`);
  console.log(`  Deployer: ${deployer.address}`);
  const bal = await deployer.getBalance();
  console.log(`  Balance:  ${hre.ethers.utils.formatEther(bal)} LITHO`);
  console.log();

  // ─── TEST 1: Chain connectivity ──────────────────────────────
  console.log("━━━ TEST 1: Chain Connectivity ━━━");
  try {
    const blockNum = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNum);
    ok(`Latest block: #${blockNum} (${new Date(block.timestamp * 1000).toISOString()})`);

    // Check block is recent (within 60s)
    const age = Math.floor(Date.now() / 1000) - block.timestamp;
    if (age < 60) ok(`Block age: ${age}s (chain is live)`);
    else fail(`Block age: ${age}s`, "Block is stale — chain may be halted");
  } catch (e) { fail("Block fetch", e.message); }

  try {
    if (network.chainId === 900523) ok(`Chain ID: 900523 (Kamet)`);
    else fail("Chain ID", `Expected 900523, got ${network.chainId}`);
  } catch (e) { fail("Chain ID check", e.message); }

  // ─── TEST 2: Native LITHO transfer ──────────────────────────
  console.log("\n━━━ TEST 2: Native LITHO Transfer ━━━");
  try {
    const amount = hre.ethers.utils.parseEther("1.0");
    const balBefore = await provider.getBalance(TEST_RECIPIENT);
    const tx = await deployer.sendTransaction({
      to: TEST_RECIPIENT,
      value: amount,
      gasLimit: 21000,
    });
    const receipt = await tx.wait();
    ok(`Sent 1 LITHO → ${TEST_RECIPIENT.slice(0,10)}... (tx: ${tx.hash.slice(0,14)}...)`);

    if (receipt.status === 1) ok(`Receipt status: success (block #${receipt.blockNumber})`);
    else fail("Receipt status", "Transaction reverted");

    const balAfter = await provider.getBalance(TEST_RECIPIENT);
    const diff = balAfter.sub(balBefore);
    if (diff.eq(amount)) ok(`Recipient balance increased by 1 LITHO`);
    else fail("Balance check", `Expected +1e18, got +${diff.toString()}`);

    // Gas used
    ok(`Gas used: ${receipt.gasUsed.toString()} (effective price: ${hre.ethers.utils.formatUnits(receipt.effectiveGasPrice, "gwei")} gwei)`);
  } catch (e) { fail("LITHO transfer", e.message); }

  // ─── TEST 3: ERC20 token reads ──────────────────────────────
  console.log("\n━━━ TEST 3: ERC20 Token Verification (all 10) ━━━");
  for (const [sym, addr] of Object.entries(TOKENS)) {
    try {
      const token = new hre.ethers.Contract(addr, ERC20_ABI, provider);
      const [name, symbol, decimals, totalSupply, deployerBal] = await Promise.all([
        token.name(), token.symbol(), token.decimals(),
        token.totalSupply(), token.balanceOf(deployer.address),
      ]);
      const supplyFmt = hre.ethers.utils.formatUnits(totalSupply, decimals);
      const balFmt = hre.ethers.utils.formatUnits(deployerBal, decimals);
      if (symbol === sym) ok(`${sym}: ${name} | supply=${supplyFmt} | deployer=${balFmt}`);
      else fail(sym, `Symbol mismatch: expected ${sym}, got ${symbol}`);
    } catch (e) { fail(`${sym} read`, e.message); }
  }

  // ─── TEST 4: ERC20 transfer ─────────────────────────────────
  console.log("\n━━━ TEST 4: ERC20 Token Transfer ━━━");
  try {
    const token = new hre.ethers.Contract(TOKENS.wLITHO, ERC20_ABI, deployer);
    const amount = hre.ethers.utils.parseEther("100"); // 100 wLITHO
    const balBefore = await token.balanceOf(TEST_RECIPIENT);
    const tx = await token.transfer(TEST_RECIPIENT, amount, { gasLimit: 100000 });
    const receipt = await tx.wait();
    if (receipt.status === 1) ok(`Transferred 100 wLITHO → ${TEST_RECIPIENT.slice(0,10)}... (tx: ${tx.hash.slice(0,14)}...)`);
    else fail("wLITHO transfer", "Reverted");

    const balAfter = await token.balanceOf(TEST_RECIPIENT);
    if (balAfter.sub(balBefore).eq(amount)) ok(`Recipient wLITHO balance: +100`);
    else fail("wLITHO balance", `Unexpected delta: ${balAfter.sub(balBefore).toString()}`);
  } catch (e) { fail("wLITHO transfer", e.message); }

  // ─── TEST 5: Bridge contract state ──────────────────────────
  console.log("\n━━━ TEST 5: Bridge Contract State ━━━");
  const bridge = new hre.ethers.Contract(BRIDGE, BRIDGE_ABI, deployer);
  try {
    const validators = await bridge.getValidators();
    ok(`Validators: ${validators.length} registered`);
    validators.forEach((v, i) => console.log(`         [${i}] ${v}`));

    const sigsReq = await bridge.signaturesRequired();
    if (sigsReq.toNumber() === 2) ok(`Signatures required: ${sigsReq} of ${validators.length}`);
    else fail("Sigs required", `Expected 2, got ${sigsReq}`);

    const nonce = await bridge.nonce();
    ok(`Current nonce: ${nonce.toString()}`);
  } catch (e) { fail("Bridge state", e.message); }

  // Check all tokens are supported
  try {
    let allSupported = true;
    for (const [sym, addr] of Object.entries(TOKENS)) {
      const supported = await bridge.supportedTokens(addr);
      if (!supported) { allSupported = false; fail(`${sym} supported`, "false"); }
    }
    if (allSupported) ok(`All 10 tokens registered as supported`);
  } catch (e) { fail("Token support check", e.message); }

  // ─── TEST 6: Bridge lockTokens (cross-chain swap) ──────────
  console.log("\n━━━ TEST 6: Cross-Chain Bridge Lock (wLITHO → Sepolia) ━━━");
  try {
    const token = new hre.ethers.Contract(TOKENS.wLITHO, ERC20_ABI, deployer);
    const lockAmount = hre.ethers.utils.parseEther("50"); // 50 wLITHO

    // Step 1: Approve bridge to spend tokens
    const approveTx = await token.approve(BRIDGE, lockAmount, { gasLimit: 100000 });
    const approveReceipt = await approveTx.wait();
    if (approveReceipt.status === 1) ok(`Approved bridge to spend 50 wLITHO (tx: ${approveTx.hash.slice(0,14)}...)`);
    else fail("Approve", "Reverted");

    // Verify allowance
    const allowance = await token.allowance(deployer.address, BRIDGE);
    if (allowance.gte(lockAmount)) ok(`Allowance confirmed: ${hre.ethers.utils.formatEther(allowance)} wLITHO`);
    else fail("Allowance", `Only ${allowance.toString()}`);

    // Step 2: Lock tokens (cross-chain to Sepolia)
    const nonceBefore = await bridge.nonce();
    const lockTx = await bridge.lockTokens(TOKENS.wLITHO, lockAmount, TARGET_CHAIN_SEPOLIA, { gasLimit: 300000 });
    const lockReceipt = await lockTx.wait();

    if (lockReceipt.status === 1) ok(`lockTokens succeeded (tx: ${lockTx.hash.slice(0,14)}...)`);
    else fail("lockTokens", "Reverted");

    ok(`Gas used: ${lockReceipt.gasUsed.toString()}, block #${lockReceipt.blockNumber}`);

    // Check nonce incremented
    const nonceAfter = await bridge.nonce();
    if (nonceAfter.gt(nonceBefore)) ok(`Nonce incremented: ${nonceBefore} → ${nonceAfter}`);
    else fail("Nonce", `Did not increment: ${nonceBefore} → ${nonceAfter}`);

    // Parse TokensLocked event
    const lockEvent = lockReceipt.logs.find(log => {
      try {
        return bridge.interface.parseLog(log).name === "TokensLocked";
      } catch { return false; }
    });
    if (lockEvent) {
      const parsed = bridge.interface.parseLog(lockEvent);
      ok(`TokensLocked event emitted:`);
      console.log(`         txHash:      ${parsed.args.txHash}`);
      console.log(`         token:       ${parsed.args.token}`);
      console.log(`         user:        ${parsed.args.user}`);
      console.log(`         amount:      ${hre.ethers.utils.formatEther(parsed.args.amount)} wLITHO`);
      console.log(`         targetChain: ${parsed.args.targetChain}`);
      console.log(`         nonce:       ${parsed.args.nonce}`);

      // Step 3: Check bridge API picked it up
      console.log("\n  ⏳ Waiting 8s for bridge-api event listener to process...");
      await new Promise(r => setTimeout(r, 8000));

      // We can't hit the bridge-api from here (it's on the indexer), but we log the txHash
      // for manual verification
      ok(`Bridge lock txHash for API check: ${lockTx.hash}`);
    } else {
      fail("TokensLocked event", "Not found in receipt logs");
    }
  } catch (e) { fail("Bridge lock", e.message); }

  // ─── TEST 7: Second bridge lock (different token) ───────────
  console.log("\n━━━ TEST 7: Cross-Chain Bridge Lock (AGII → Sepolia) ━━━");
  try {
    const token = new hre.ethers.Contract(TOKENS.AGII, ERC20_ABI, deployer);
    const lockAmount = hre.ethers.utils.parseEther("1000"); // 1000 AGII

    const approveTx = await token.approve(BRIDGE, lockAmount, { gasLimit: 100000 });
    await approveTx.wait();
    ok(`Approved bridge for 1000 AGII`);

    const lockTx = await bridge.lockTokens(TOKENS.AGII, lockAmount, TARGET_CHAIN_SEPOLIA, { gasLimit: 300000 });
    const lockReceipt = await lockTx.wait();
    if (lockReceipt.status === 1) ok(`lockTokens AGII succeeded (tx: ${lockTx.hash.slice(0,14)}...)`);
    else fail("lockTokens AGII", "Reverted");

    const lockEvent = lockReceipt.logs.find(log => {
      try { return bridge.interface.parseLog(log).name === "TokensLocked"; } catch { return false; }
    });
    if (lockEvent) {
      const parsed = bridge.interface.parseLog(lockEvent);
      ok(`TokensLocked: ${hre.ethers.utils.formatEther(parsed.args.amount)} AGII → chain ${parsed.args.targetChain}`);
    }
  } catch (e) { fail("AGII bridge lock", e.message); }

  // ─── TEST 8: Multi-token transfer batch ─────────────────────
  console.log("\n━━━ TEST 8: Multi-Token Transfer Batch ━━━");
  const batchTokens = ["LitBTC", "LAX", "JOT", "IMAGE", "MUSA"];
  for (const sym of batchTokens) {
    try {
      const token = new hre.ethers.Contract(TOKENS[sym], ERC20_ABI, deployer);
      const amount = hre.ethers.utils.parseEther("10");
      const tx = await token.transfer(TEST_RECIPIENT, amount, { gasLimit: 100000 });
      const receipt = await tx.wait();
      if (receipt.status === 1) ok(`${sym}: sent 10 → ${TEST_RECIPIENT.slice(0,10)}...`);
      else fail(`${sym} transfer`, "Reverted");
    } catch (e) { fail(`${sym} transfer`, e.message); }
  }

  // ─── RESULTS ────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

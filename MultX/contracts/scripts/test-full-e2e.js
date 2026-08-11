/**
 * FULL END-TO-END TEST: Chain, tokens, transfers, bridge lock, API verification
 * Tests the complete flow from on-chain txns through to bridge API responses
 */
const hre = require("hardhat");
const https = require("https");

const BRIDGE = "0x95B646bF6629A379AD898DC58D011fd3111e5700";
const TOKENS = {
  wLITHO: "0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2",
  LitBTC: "0x12C9d1358edb0DBe13E2B8817B3c32899C2C75bE",
  LAX:    "0x508a1cB83949C9E0EB5FE698d11438EF55bFb5E1",
  JOT:    "0xED604cCD5F6097f3459b1D550133Bb50e79E3BAA",
  COLLE:  "0xCD9E54Ff1628AAB482376B853667f47E72c2a71c",
  IMAGE:  "0x85ce74df843bD0b8396Ecf67bDc4F88e6C1d3d58",
  AGII:   "0x4347C4D6A34e278df8414510e7920aED21563C9e",
  BLDR:   "0xc7321D4F577eF95CdBEAE2CFbA8db67B96c02B7a",
  FGPT:   "0x682575D03D3DbC7eB2e2cc0FbCb0DDEf9a1CC220",
  MUSA:   "0x882651F5C1308AE04549C5A3fE4DF67EAA9465f9",
};
const TARGET_SEPOLIA = 11155111;
const TARGET_BNB = 97;
const RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

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

const BRIDGE_API = "https://kamet.litho.ai";
const BRIDGE_API_ALT = "https://bridge.litho.ai";

let passed = 0, failed = 0;
function ok(msg) { passed++; console.log(`  [PASS] ${msg}`); }
function fail(msg, err) { failed++; console.log(`  [FAIL] ${msg}: ${err}`); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: { raw: d.slice(0, 100) } }); }
      });
    }).on("error", reject);
  });
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const provider = deployer.provider;
  const network = await provider.getNetwork();

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     KAMET FULL END-TO-END VERIFICATION SUITE          ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`  Chain: ${network.chainId} | Deployer: ${deployer.address}`);
  console.log(`  Balance: ${hre.ethers.utils.formatEther(await deployer.getBalance())} LITHO\n`);

  // ═══════════════════════════════════════════════════════════
  // SECTION 1: CHAIN HEALTH
  // ═══════════════════════════════════════════════════════════
  console.log("── 1. CHAIN HEALTH ──────────────────────────────────────");
  const block = await provider.getBlock(await provider.getBlockNumber());
  const age = Math.floor(Date.now() / 1000) - block.timestamp;
  if (network.chainId === 900523) ok(`Chain ID: 900523 (Kamet)`); else fail("Chain ID", network.chainId);
  if (age < 30) ok(`Block #${block.number}, age ${age}s — chain producing`);
  else fail("Block freshness", `${age}s old`);

  // ═══════════════════════════════════════════════════════════
  // SECTION 2: NATIVE LITHO TRANSFER
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 2. NATIVE LITHO TRANSFER ─────────────────────────────");
  const sendAmt = hre.ethers.utils.parseEther("1.5");
  const balBefore = await provider.getBalance(RECIPIENT);
  const tx1 = await deployer.sendTransaction({ to: RECIPIENT, value: sendAmt, gasLimit: 21000 });
  const rcpt1 = await tx1.wait();
  if (rcpt1.status === 1) ok(`Sent 1.5 LITHO, tx: ${tx1.hash.slice(0,18)}...`);
  else fail("LITHO transfer", "reverted");
  const balAfter = await provider.getBalance(RECIPIENT);
  if (balAfter.sub(balBefore).eq(sendAmt)) ok("Recipient balance +1.5 LITHO"); else fail("Balance delta", balAfter.sub(balBefore).toString());
  ok(`Gas: ${rcpt1.gasUsed}, price: ${hre.ethers.utils.formatUnits(rcpt1.effectiveGasPrice, "gwei")} gwei`);

  // ═══════════════════════════════════════════════════════════
  // SECTION 3: ALL 10 ERC20 TOKENS
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 3. ERC20 TOKEN VERIFICATION (10 tokens) ─────────────");
  for (const [sym, addr] of Object.entries(TOKENS)) {
    try {
      const t = new hre.ethers.Contract(addr, ERC20_ABI, provider);
      const [name, symbol, dec, supply] = await Promise.all([t.name(), t.symbol(), t.decimals(), t.totalSupply()]);
      if (symbol === sym) ok(`${sym.padEnd(7)} ${name.padEnd(22)} supply=${hre.ethers.utils.formatUnits(supply, dec)}`);
      else fail(sym, `symbol mismatch: ${symbol}`);
    } catch (e) { fail(sym, e.message); }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 4: ERC20 TRANSFERS (3 tokens)
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 4. ERC20 TRANSFERS ───────────────────────────────────");
  for (const sym of ["wLITHO", "LitBTC", "AGII"]) {
    try {
      const t = new hre.ethers.Contract(TOKENS[sym], ERC20_ABI, deployer);
      const amt = hre.ethers.utils.parseEther("50");
      const bb = await t.balanceOf(RECIPIENT);
      const tx = await t.transfer(RECIPIENT, amt, { gasLimit: 100000 });
      const r = await tx.wait();
      const ba = await t.balanceOf(RECIPIENT);
      if (r.status === 1 && ba.sub(bb).eq(amt)) ok(`${sym}: sent 50 → ${RECIPIENT.slice(0,10)}...`);
      else fail(`${sym} transfer`, "balance mismatch");
    } catch (e) { fail(`${sym} transfer`, e.message); }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 5: BRIDGE CONTRACT STATE
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 5. BRIDGE CONTRACT STATE ─────────────────────────────");
  const bridge = new hre.ethers.Contract(BRIDGE, BRIDGE_ABI, deployer);
  const validators = await bridge.getValidators();
  const sigsReq = await bridge.signaturesRequired();
  ok(`Validators: ${validators.length}, Sigs required: ${sigsReq}`);
  let allSupported = true;
  for (const [sym, addr] of Object.entries(TOKENS)) {
    if (!(await bridge.supportedTokens(addr))) { allSupported = false; fail(`${sym} supported`, "false"); }
  }
  if (allSupported) ok("All 10 tokens supported in bridge");

  // ═══════════════════════════════════════════════════════════
  // SECTION 6: CROSS-CHAIN BRIDGE LOCK — wLITHO → Sepolia
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 6. BRIDGE LOCK: wLITHO → Sepolia ────────────────────");
  const lockAmt1 = hre.ethers.utils.parseEther("20");
  const token1 = new hre.ethers.Contract(TOKENS.wLITHO, ERC20_ABI, deployer);
  await (await token1.approve(BRIDGE, lockAmt1, { gasLimit: 100000 })).wait();
  ok("Approved bridge for 20 wLITHO");
  const nonceBefore1 = await bridge.nonce();
  const lockTx1 = await bridge.lockTokens(TOKENS.wLITHO, lockAmt1, TARGET_SEPOLIA, { gasLimit: 300000 });
  const lockRcpt1 = await lockTx1.wait();
  if (lockRcpt1.status === 1) ok(`lockTokens TX: ${lockTx1.hash.slice(0,18)}... block #${lockRcpt1.blockNumber}`);
  else fail("lockTokens", "reverted");
  const nonceAfter1 = await bridge.nonce();
  if (nonceAfter1.gt(nonceBefore1)) ok(`Nonce: ${nonceBefore1} → ${nonceAfter1}`);
  else fail("Nonce increment", `${nonceBefore1} → ${nonceAfter1}`);

  // Parse event
  let eventHash1;
  const evt1 = lockRcpt1.logs.find(l => { try { return bridge.interface.parseLog(l).name === "TokensLocked"; } catch { return false; } });
  if (evt1) {
    const p = bridge.interface.parseLog(evt1);
    eventHash1 = p.args.txHash;
    ok(`TokensLocked event: ${hre.ethers.utils.formatEther(p.args.amount)} wLITHO → chain ${p.args.targetChain}`);
    console.log(`         eventHash: ${eventHash1}`);
  } else { fail("TokensLocked event", "not found"); }

  // ═══════════════════════════════════════════════════════════
  // SECTION 7: BRIDGE LOCK — BLDR → BNB Testnet
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 7. BRIDGE LOCK: BLDR → BNB Testnet ──────────────────");
  const lockAmt2 = hre.ethers.utils.parseEther("500");
  const token2 = new hre.ethers.Contract(TOKENS.BLDR, ERC20_ABI, deployer);
  await (await token2.approve(BRIDGE, lockAmt2, { gasLimit: 100000 })).wait();
  ok("Approved bridge for 500 BLDR");
  const lockTx2 = await bridge.lockTokens(TOKENS.BLDR, lockAmt2, TARGET_BNB, { gasLimit: 300000 });
  const lockRcpt2 = await lockTx2.wait();
  let eventHash2;
  if (lockRcpt2.status === 1) {
    ok(`lockTokens TX: ${lockTx2.hash.slice(0,18)}... block #${lockRcpt2.blockNumber}`);
    const evt2 = lockRcpt2.logs.find(l => { try { return bridge.interface.parseLog(l).name === "TokensLocked"; } catch { return false; } });
    if (evt2) {
      const p = bridge.interface.parseLog(evt2);
      eventHash2 = p.args.txHash;
      ok(`TokensLocked: ${hre.ethers.utils.formatEther(p.args.amount)} BLDR → chain ${p.args.targetChain}`);
    }
  } else fail("BLDR lock", "reverted");

  // ═══════════════════════════════════════════════════════════
  // SECTION 8: BRIDGE API VERIFICATION
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 8. BRIDGE API VERIFICATION ───────────────────────────");
  console.log("  Waiting 15s for event listener + mock signing...");
  await sleep(15000);

  // Check via kamet.litho.ai
  if (eventHash1) {
    try {
      const s = await fetchJSON(`${BRIDGE_API}/bridge/status/${eventHash1}`);
      if (s.status === 200 && s.data.txHash) {
        ok(`[kamet.litho.ai] /status: ${s.data.status || s.data.dbStatus}, sigs: ${s.data.signaturesCollected}/${s.data.signaturesRequired}`);
      } else fail("[kamet.litho.ai] /status", JSON.stringify(s.data).slice(0,100));
    } catch (e) { fail("[kamet.litho.ai] /status", e.message); }

    try {
      const s = await fetchJSON(`${BRIDGE_API}/bridge/signatures/${eventHash1}`);
      if (s.status === 200 && s.data.signatures?.length >= 2) {
        ok(`[kamet.litho.ai] /signatures: ${s.data.signatures.length} sigs`);
      } else fail("[kamet.litho.ai] /signatures", `${s.data.signatures?.length || 0} sigs`);
    } catch (e) { fail("[kamet.litho.ai] /signatures", e.message); }
  }

  // Check transactions list
  try {
    const s = await fetchJSON(`${BRIDGE_API}/bridge/transactions/${deployer.address}`);
    if (s.status === 200 && s.data.transactions?.length >= 2) {
      ok(`[kamet.litho.ai] /transactions: ${s.data.transactions.length} txns for deployer`);
    } else fail("[kamet.litho.ai] /transactions", `${s.data.transactions?.length || 0} txns`);
  } catch (e) { fail("[kamet.litho.ai] /transactions", e.message); }

  // Check via bridge.litho.ai
  if (eventHash2) {
    try {
      const s = await fetchJSON(`${BRIDGE_API_ALT}/bridge/status/${eventHash2}`);
      if (s.status === 200 && s.data.txHash) {
        ok(`[bridge.litho.ai] /status BLDR: ${s.data.status || s.data.dbStatus}`);
      } else fail("[bridge.litho.ai] /status", JSON.stringify(s.data).slice(0,100));
    } catch (e) { fail("[bridge.litho.ai] /status", e.message); }
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 9: KAMET EXPLORER FRONTEND
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 9. KAMET EXPLORER FRONTEND ───────────────────────────");
  try {
    const s = await fetchJSON("https://kamet.litho.ai/");
    if (s.status === 200) ok("kamet.litho.ai loads (HTTP 200)");
    else fail("Explorer frontend", `HTTP ${s.status}`);
  } catch (e) { fail("Explorer frontend", e.message); }

  // ═══════════════════════════════════════════════════════════
  // SECTION 10: RPC ENDPOINTS
  // ═══════════════════════════════════════════════════════════
  console.log("\n── 10. PUBLIC RPC ENDPOINTS ─────────────────────────────");
  for (const [name, url, body] of [
    ["rpc-3.litho.ai/status", "https://rpc-3.litho.ai/status", null],
    ["api-3.litho.ai/cosmos/base/tendermint/v1beta1/blocks/latest", "https://api-3.litho.ai/cosmos/base/tendermint/v1beta1/blocks/latest", null],
  ]) {
    try {
      const s = await fetchJSON(url);
      if (s.status === 200) ok(`${name}: OK`);
      else fail(name, `HTTP ${s.status}`);
    } catch (e) { fail(name, e.message); }
  }

  // ═══════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log(`║  RESULTS: ${passed} PASSED  ${failed} FAILED  ${passed+failed} TOTAL${" ".repeat(Math.max(0,20-String(passed+failed).length))}║`);
  console.log("╚════════════════════════════════════════════════════════╝");
  if (failed > 0) process.exit(1);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

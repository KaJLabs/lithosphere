/**
 * Route 1 end-to-end test — bridge a small amount Makalu → Kamet and confirm
 * the release actually fires.
 *
 * Flow: lock TOKEN on the Makalu bridge (target = Kamet 900523) as the signer,
 * poll the bridge-api for `completed`, then verify the signer's balance of the
 * Kamet-side token went up by the bridged amount (released from the seeded
 * reserve). Run AFTER seeding both bridges.
 *
 * Signer = 0x10ed… (holds Makalu tokens; release lands back to the same address
 * on Kamet). Uses a separate provider to read Kamet state.
 *
 * Usage (source chain = Makalu):
 *   DEPLOYER_PRIVATE_KEY=0x... [TEST_TOKEN=FGPT] [TEST_AMOUNT=10] \
 *   npx hardhat run scripts/test-makalu-kamet-bridge.js --network litho_makalu
 */

const hre = require("hardhat");

const MAKALU_BRIDGE = "0x5832D5E609c6690f74c7683606Eb20F89ff096a6";
const KAMET_RPC = process.env.KAMET_RPC_HTTP || "https://rpc-3.litho.ai";
const BRIDGE_API = (process.env.BRIDGE_API || "https://bridge.litho.ai").replace(/\/$/, "");
const KAMET_CHAIN_ID = 900523;

// symbol → [makaluToken, kametToken]
const PAIRS = {
  wLITHO: ["0x599a7E135f1790ae117b4EdDc0422D24Bc766161", "0xC0FC628e3aB128fe387e7ed5e729bD809C017888"],
  LitBTC: ["0xC4645CA5411D6E27556780AB4cdd0DF7e609df74", "0x3A8D5FdC6c8dA9f14C535424b6F7206eC1996016"],
  LAX:    ["0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d", "0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb"],
  JOT:    ["0xEF2f35f6d0fb7DC9E87b8ca8252AE2E6ffb2a25e", "0x6AE14CEb3962664b13c5dEF29EB172De76bd0ac9"],
  COLLE:  ["0x10D4BB600c96e9243E2f50baFED8b2478F25af61", "0x0573f66cb4bC34618e7AB8a941F7883DD2515dCA"],
  IMAGE:  ["0xAcD98E323968647936887aD4934e64B01060727e", "0x8Ba6E3A0759144245f2939eB54164e32bb78B8E0"],
  AGII:   ["0x10052B8ccD2160b8F9880C6b4F5DD117fF253B1c", "0x17D506aF1d0Dc2f4f64f15748a5aC46FAd3f06D7"],
  BLDR:   ["0x798eD6bFc5bfCFc60938d5098825b354427A0786", "0xF05f1F79273874E554F02ce06585E16132a3B62B"],
  FGPT:   ["0x151ef362eA96853702Cc5e7728107e3961fbD22e", "0x2F366c6350A6b211f6D6F847c3D56738C2E847ca"],
  MUSA:   ["0xDB829befCF8E582379E2c034FA2589b8D2EA1c5D", "0x17A357262097B4e70acFfe8B71bC61e8bBcc3B42"],
};

const ERC20 = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];
const BRIDGE = [
  "function lockTokens(address token, uint256 amount, uint256 targetChain) returns (bytes32)",
  // The bridge-api keys releases on the internal bridge txHash emitted here — NOT
  // the Ethereum tx hash — so we parse it out of the receipt to poll status.
  "event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 targetChain, uint256 nonce)",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Case-insensitive match so mixed-case symbols (wLITHO, LitBTC) work too.
  const reqSym = process.env.TEST_TOKEN || "FGPT";
  const sym = Object.keys(PAIRS).find((k) => k.toLowerCase() === reqSym.toLowerCase());
  const pair = sym && PAIRS[sym];
  if (!pair) { console.error(`Unknown TEST_TOKEN ${reqSym}. One of: ${Object.keys(PAIRS).join(", ")}`); process.exit(1); }
  const [makaluToken, kametToken] = pair;

  const [signer] = await hre.ethers.getSigners();
  const net = await signer.provider.getNetwork();
  if (net.chainId !== 700777) { console.error("Run with --network litho_makalu (700777)."); process.exit(1); }
  const amount = hre.ethers.utils.parseUnits(process.env.TEST_AMOUNT || "10", 18);

  console.log("=".repeat(60));
  console.log(`  E2E TEST — bridge ${process.env.TEST_AMOUNT || "10"} ${sym} : Makalu → Kamet`);
  console.log("=".repeat(60));
  console.log(`User:         ${signer.address}`);
  console.log(`Makalu token: ${makaluToken}`);
  console.log(`Kamet token:  ${kametToken}`);

  const kProvider = new hre.ethers.providers.JsonRpcProvider(KAMET_RPC);
  const kToken = new hre.ethers.Contract(kametToken, ERC20, kProvider);
  const destBefore = await kToken.balanceOf(signer.address);
  console.log(`\nKamet ${sym} balance BEFORE: ${hre.ethers.utils.formatUnits(destBefore, 18)}`);

  // 1) approve + lock on Makalu
  const token = new hre.ethers.Contract(makaluToken, ERC20, signer);
  const bridge = new hre.ethers.Contract(MAKALU_BRIDGE, BRIDGE, signer);
  console.log("\n[1/3] approve…");
  await (await token.approve(MAKALU_BRIDGE, amount, { gasLimit: 100_000 })).wait();
  console.log("[2/3] lockTokens → target Kamet…");
  const lockTx = await bridge.lockTokens(makaluToken, amount, KAMET_CHAIN_ID, { gasLimit: 300_000 });
  const rcpt = await lockTx.wait();
  console.log(`      lock tx: ${lockTx.hash} (block ${rcpt.blockNumber})`);

  // The bridge-api indexes by the internal bridge txHash from the TokensLocked
  // event, not lockTx.hash — extract it from the receipt so we poll the right key.
  let bridgeTxHash = null;
  for (const log of rcpt.logs) {
    if (log.address.toLowerCase() !== MAKALU_BRIDGE.toLowerCase()) continue;
    try {
      const ev = bridge.interface.parseLog(log);
      if (ev.name === "TokensLocked") { bridgeTxHash = ev.args.txHash; break; }
    } catch { /* not a bridge event */ }
  }
  if (!bridgeTxHash) { console.error("ERROR: TokensLocked event not found in lock receipt."); process.exit(1); }
  console.log(`      bridge txHash: ${bridgeTxHash}`);

  // 2) poll bridge-api for completion (keyed by bridge txHash)
  console.log("[3/3] polling bridge-api for release…");
  let status = "pending";
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    try {
      const r = await fetch(`${BRIDGE_API}/bridge/status/${bridgeTxHash}`);
      const j = await r.json().catch(() => ({}));
      status = j.status || status;
      process.stdout.write(`  ${status}…`);
      if (status === "completed" || status === "failed") { console.log(); break; }
    } catch { /* transient */ }
  }
  console.log(`  final status: ${status}`);

  // 3) verify dest balance increased
  const destAfter = await kToken.balanceOf(signer.address);
  const delta = destAfter.sub(destBefore);
  console.log(`\nKamet ${sym} balance AFTER:  ${hre.ethers.utils.formatUnits(destAfter, 18)}  (Δ ${hre.ethers.utils.formatUnits(delta, 18)})`);

  if (delta.gte(amount)) {
    console.log(`\n✅ PASS — released ${hre.ethers.utils.formatUnits(delta, 18)} ${sym} on Kamet.`);
  } else {
    console.log(`\n❌ NOT yet released (Δ < amount). status=${status}.`);
    console.log(`   Check: bridge-api logs, ${BRIDGE_API}/bridge/signatures/${bridgeTxHash}, and Kamet bridge ${sym} reserve.`);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

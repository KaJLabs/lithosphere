/**
 * Test full bridge flow: lock → event listener → DB → mock signing → API query
 * Runs the lock on-chain then polls the bridge API to verify the full pipeline
 */
const hre = require("hardhat");
const https = require("https");
const http = require("http");

const BRIDGE = "0x95B646bF6629A379AD898DC58D011fd3111e5700";
const wLITHO = "0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2";
const TARGET_CHAIN_SEPOLIA = 11155111;

// Bridge API on indexer (via kamet.litho.ai nginx proxy)
const BRIDGE_API = "https://kamet.litho.ai";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
const BRIDGE_ABI = [
  "function lockTokens(address token, uint256 amount, uint256 targetChain)",
  "function nonce() view returns (uint256)",
  "event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 targetChain, uint256 nonce)",
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { rejectUnauthorized: false }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    }).on("error", reject);
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("=".repeat(60));
  console.log("  FULL BRIDGE FLOW TEST");
  console.log("=".repeat(60));

  const token = new hre.ethers.Contract(wLITHO, ERC20_ABI, deployer);
  const bridge = new hre.ethers.Contract(BRIDGE, BRIDGE_ABI, deployer);
  const lockAmount = hre.ethers.utils.parseEther("25");

  // Step 1: Approve + Lock
  console.log("\n[1] Approve + Lock 25 wLITHO → Sepolia...");
  const approveTx = await token.approve(BRIDGE, lockAmount, { gasLimit: 100000 });
  await approveTx.wait();
  console.log(`    Approved (tx: ${approveTx.hash})`);

  const lockTx = await bridge.lockTokens(wLITHO, lockAmount, TARGET_CHAIN_SEPOLIA, { gasLimit: 300000 });
  const lockReceipt = await lockTx.wait();
  console.log(`    Locked (tx: ${lockTx.hash})`);
  console.log(`    Block: #${lockReceipt.blockNumber}, Gas: ${lockReceipt.gasUsed.toString()}`);

  // Parse event
  const lockEvent = lockReceipt.logs.find(log => {
    try { return bridge.interface.parseLog(log).name === "TokensLocked"; } catch { return false; }
  });
  const parsed = bridge.interface.parseLog(lockEvent);
  const eventTxHash = parsed.args.txHash;
  console.log(`    Event txHash: ${eventTxHash}`);
  console.log(`    Event nonce:  ${parsed.args.nonce.toString()}`);

  // Step 2: Poll bridge API for the transaction to appear
  console.log("\n[2] Polling bridge API for transaction...");
  const apiStatusUrl = `${BRIDGE_API}/bridge/status/${lockTx.hash}`;
  const apiSigsUrl = `${BRIDGE_API}/bridge/signatures/${lockTx.hash}`;
  const apiTxsUrl = `${BRIDGE_API}/bridge/transactions/${deployer.address}`;

  let found = false;
  for (let i = 0; i < 12; i++) {
    console.log(`    Poll ${i + 1}/12 (waiting 5s)...`);
    await sleep(5000);

    try {
      const status = await fetchJSON(apiStatusUrl);
      console.log(`    /status: ${JSON.stringify(status)}`);

      if (status.status && status.status !== "not_found") {
        found = true;
        console.log(`    ✅ Transaction found in bridge DB! Status: ${status.status}`);

        // Check signatures
        const sigs = await fetchJSON(apiSigsUrl);
        console.log(`    /signatures: ${sigs.signatures?.length || 0} signatures`);
        if (sigs.signatures?.length > 0) {
          console.log(`    ✅ Mock validators signed!`);
          sigs.signatures.forEach((s, i) => console.log(`       [${i}] ${s.validator_address}: ${s.signature?.slice(0, 20)}...`));
        }

        // Check transactions list
        const txs = await fetchJSON(apiTxsUrl);
        console.log(`    /transactions: ${txs.transactions?.length || 0} total for deployer`);
        break;
      }
    } catch (err) {
      console.log(`    Error: ${err.message}`);
    }
  }

  if (!found) {
    console.log("\n    ⚠️  Transaction not picked up by bridge API within 60s.");
    console.log("    This could mean the event listener didn't capture the event.");
    console.log("    Check bridge-api logs: docker logs bridge-api --tail 30");
  }

  // Step 3: Summary
  console.log("\n" + "=".repeat(60));
  console.log("  FLOW SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Lock TX:     ${lockTx.hash}`);
  console.log(`  Event Hash:  ${eventTxHash}`);
  console.log(`  Amount:      25 wLITHO`);
  console.log(`  Target:      Sepolia (${TARGET_CHAIN_SEPOLIA})`);
  console.log(`  API pickup:  ${found ? "YES ✅" : "NO ⚠️"}`);
  console.log("=".repeat(60));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

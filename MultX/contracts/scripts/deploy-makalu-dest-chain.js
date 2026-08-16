/**
 * Route 2 — deploy Makalu-origin wrapped tokens on a destination chain
 * (Sepolia / Base Sepolia) and register them on the EXISTING MultXBridgeDest.
 *
 * Plan 2a: reuse the live dest bridge (0xfdA3b83F… on both Sepolia and Base)
 * rather than standing up a second one. That bridge already carries the
 * Kamet-origin wrapped tokens and the correct 7/5 KMS validator set, so a
 * Makalu lock and a Kamet lock both release through the same contract — only
 * the wrapped token differs (each WrappedLEP100 is immutably bound to one
 * origin token + origin chain id).
 *
 * Makalu-origin wrapped tokens use an `m` symbol prefix (mwLITHO, mLAX, …) to
 * stay distinct from the Kamet-origin `w`-prefixed wrapped tokens already on
 * the dest bridge.
 *
 * OWNER KEY: `addSupportedToken` is onlyOwner on the destination bridge. Read
 * the current owner on-chain and load its key from the approved secret manager;
 * the script asserts signer==owner. Ensure that owner is funded on both chains.
 *
 * Usage (run once per dest chain):
 *   DEPLOYER_PRIVATE_KEY=<0x6731 key> \
 *   npx hardhat run scripts/deploy-makalu-dest-chain.js --network sepolia
 *   npx hardhat run scripts/deploy-makalu-dest-chain.js --network base_sepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const MAKALU_CHAIN_ID = 700777;
const DEST_BRIDGE = process.env.DEST_BRIDGE || "0xfdA3b83FE8438123eAF5153945A46F8fcF6175f4";
const SUPPORTED_DEST_CHAINS = [11155111, 84532]; // Sepolia, Base Sepolia

// Makalu-origin LEP100 tokens (700777), verified on-chain 2026-06-17.
// QTT is Kamet-only → 10 tokens. wrappedSymbol = "m" + symbol.
const MAKALU_TOKENS = [
  { name: "Wrapped LITHO",       symbol: "wLITHO", origin: "0x599a7E135f1790ae117b4EdDc0422D24Bc766161" },
  { name: "Lithosphere Bitcoin", symbol: "LitBTC", origin: "0xC4645CA5411D6E27556780AB4cdd0DF7e609df74" },
  { name: "LAX Token",           symbol: "LAX",    origin: "0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d" },
  { name: "JOT Token",           symbol: "JOT",    origin: "0xEF2f35f6d0fb7DC9E87b8ca8252AE2E6ffb2a25e" },
  { name: "Colle AI",            symbol: "COLLE",  origin: "0x10D4BB600c96e9243E2f50baFED8b2478F25af61" },
  { name: "Image AI",            symbol: "IMAGE",  origin: "0xAcD98E323968647936887aD4934e64B01060727e" },
  { name: "AGI Inception",       symbol: "AGII",   origin: "0x10052B8ccD2160b8F9880C6b4F5DD117fF253B1c" },
  { name: "Builder Finance",     symbol: "BLDR",   origin: "0x798eD6bFc5bfCFc60938d5098825b354427A0786" },
  { name: "Finesse GPT",         symbol: "FGPT",   origin: "0x151ef362eA96853702Cc5e7728107e3961fbD22e" },
  { name: "Musa AI",             symbol: "MUSA",   origin: "0xDB829befCF8E582379E2c034FA2589b8D2EA1c5D" },
];

const OWNABLE_ABI = ["function owner() view returns (address)", "function addSupportedToken(address token) external", "function supportedTokens(address) view returns (bool)"];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const net = await signer.provider.getNetwork();
  console.log("=".repeat(64));
  console.log(`  ROUTE 2 — MAKALU-ORIGIN WRAPPED TOKENS → ${hre.network.name}`);
  console.log("=".repeat(64));
  console.log(`Network:     ${hre.network.name} (${net.chainId})`);
  console.log(`Signer:      ${signer.address}`);
  console.log(`Dest bridge: ${DEST_BRIDGE}`);

  if (!SUPPORTED_DEST_CHAINS.includes(net.chainId)) {
    console.error(`ERROR: chainId ${net.chainId} is not a supported dest chain (${SUPPORTED_DEST_CHAINS.join(", ")}). Use --network sepolia|base_sepolia.`);
    process.exit(1);
  }

  const bal = await signer.getBalance();
  console.log(`Balance:     ${hre.ethers.utils.formatEther(bal)} ETH`);
  if (bal.isZero()) {
    console.error("ERROR: signer has 0 ETH. Fund via packages/dnns-faucet first.");
    process.exit(1);
  }

  // The dest bridge owner must sign addSupportedToken.
  const bridge = new hre.ethers.Contract(DEST_BRIDGE, OWNABLE_ABI, signer);
  const owner = await bridge.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`ERROR: signer ${signer.address} is not the dest bridge owner (${owner}).`);
    console.error("Run with DEPLOYER_PRIVATE_KEY set to the current destination-bridge owner key from the approved secret manager.");
    process.exit(1);
  }

  const Wrapped = await hre.ethers.getContractFactory("WrappedLEP100");
  const deployed = [];

  console.log(`\n--- Deploy + register ${MAKALU_TOKENS.length} Makalu-origin wrapped tokens ---`);
  for (const t of MAKALU_TOKENS) {
    const wName = `Makalu ${t.name}`;
    const wSymbol = `m${t.symbol}`;
    try {
      const w = await Wrapped.deploy(wName, wSymbol, 18, DEST_BRIDGE, t.origin, MAKALU_CHAIN_ID, { gasLimit: 3_000_000 });
      await w.deployed();
      const tx = await bridge.addSupportedToken(w.address, { gasLimit: 120_000 });
      await tx.wait();
      console.log(`  ${wSymbol.padEnd(9)} ${w.address}  (origin ${t.origin})`);
      deployed.push({ ...t, wrappedSymbol: wSymbol, wrappedAddress: w.address });
    } catch (err) {
      console.error(`  ${wSymbol} FAILED: ${String(err.message).slice(0, 120)}`);
    }
  }

  // Save record (distinct filename — do NOT clobber the Kamet-origin dest records)
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const record = {
    network: hre.network.name,
    chainId: net.chainId,
    timestamp: new Date().toISOString(),
    deployer: signer.address,
    destBridge: DEST_BRIDGE,
    originChainId: MAKALU_CHAIN_ID,
    wrappedTokens: deployed.reduce((a, t) => {
      a[t.wrappedSymbol] = { address: t.wrappedAddress, origin: t.origin, symbol: t.symbol };
      return a;
    }, {}),
  };
  const base = `${hre.network.name}-makalu-bridge`;
  fs.writeFileSync(path.join(dir, `${base}-${ts}.json`), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(dir, `${base}-latest.json`), JSON.stringify(record, null, 2));

  console.log("\n" + "=".repeat(64));
  console.log(`  DONE — ${deployed.length}/${MAKALU_TOKENS.length} wrapped tokens on ${hre.network.name}`);
  console.log("=".repeat(64));
  console.log("  Backend wiring — add these (Makalu origin → this chain) to");
  console.log("  bridge-api/src/config.js TOKEN_PAIRS / a MAKALU_DEST_PAIRS table:");
  deployed.forEach((t) =>
    console.log(`    ['${t.origin}', '${t.wrappedAddress}', '${t.symbol}'],  // m${t.symbol}`),
  );
  if (deployed.length < MAKALU_TOKENS.length) {
    console.log(`\n  ⚠️  ${MAKALU_TOKENS.length - deployed.length} token(s) failed — re-run (likely out of gas; top up via packages/dnns-faucet).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });

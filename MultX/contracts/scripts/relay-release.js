/**
 * Manual release relayer (stand-in for the server-side release executor).
 *
 * MultXBridge.releaseTokens is permissionless: anyone may submit it with >=
 * signaturesRequired valid validator signatures, in ASCENDING signer order.
 * The bridge-api already collects validator signatures for each lock, so this
 * script fetches them and submits the release on the destination chain itself —
 * useful when the automated relayer is down.
 *
 * Usage (release lands on Kamet for a Makalu→Kamet lock):
 *   DEPLOYER_PRIVATE_KEY=0x... BRIDGE_TX_HASH=0x<internal bridge txHash> \
 *   npx hardhat run scripts/relay-release.js --network litho_kamet
 *
 * The BRIDGE_TX_HASH is the internal hash from the TokensLocked event (NOT the
 * Ethereum tx hash) — the same value the bridge-api keys on.
 */

const hre = require("hardhat");

const BRIDGE_API = (process.env.BRIDGE_API || "https://bridge.litho.ai").replace(/\/$/, "");
// Destination bridge per chainId (where releaseTokens is called).
const DEST_BRIDGE = {
  900523: "0x3a896BDF3a1088287FA84aB5a43bB30e2535F263", // Kamet
  700777: "0x5832D5E609c6690f74c7683606Eb20F89ff096a6", // Makalu
};

const BRIDGE_ABI = [
  "function releaseTokens(address token, address user, uint256 amount, uint256 sourceChain, uint256 sourceNonce, bytes32 sourceTxHash, bytes[] signatures) external",
  "function getValidators() view returns (address[])",
  "function signaturesRequired() view returns (uint256)",
  "function paused() view returns (bool)",
  "function processedNonces(uint256, uint256) view returns (bool)",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const btx = process.env.BRIDGE_TX_HASH;
  if (!btx) { console.error("Set BRIDGE_TX_HASH=0x<internal bridge txHash>."); process.exit(1); }

  const [signer] = await hre.ethers.getSigners();
  const net = await signer.provider.getNetwork();
  const bridgeAddr = DEST_BRIDGE[net.chainId];
  if (!bridgeAddr) { console.error(`chainId ${net.chainId} has no dest bridge mapping.`); process.exit(1); }

  const bridge = new hre.ethers.Contract(bridgeAddr, BRIDGE_ABI, signer);
  const required = (await bridge.signaturesRequired()).toNumber();
  const validators = new Set((await bridge.getValidators()).map((a) => a.toLowerCase()));

  console.log("=".repeat(60));
  console.log(`  RELAY RELEASE on dest ${net.chainId} bridge ${bridgeAddr}`);
  console.log("=".repeat(60));
  console.log(`Relayer: ${signer.address}`);
  console.log(`Bridge txHash: ${btx}`);
  console.log(`Signatures required: ${required}\n`);

  // 1) fetch the locked-transfer params + collected signatures from the bridge-api
  const st = await (await fetch(`${BRIDGE_API}/bridge/status/${btx}`)).json();
  if (st.error) { console.error(`bridge-api: ${st.error}`); process.exit(1); }
  const token = st.releaseToken;             // dest-side token (what the bridge releases)
  const user = st.fromAddress;
  const amount = hre.ethers.BigNumber.from(st.amount);
  const sourceChain = st.sourceChain;
  const sourceNonce = st.sourceNonce;
  console.log(`Release: ${hre.ethers.utils.formatUnits(amount, 18)} of ${token} → ${user}`);
  console.log(`Source: chain ${sourceChain} nonce ${sourceNonce}`);

  if (await bridge.paused()) { console.error("Bridge is PAUSED — aborting."); process.exit(1); }
  if (await bridge.processedNonces(sourceChain, sourceNonce)) {
    console.log("Nonce already processed — release was already executed. Nothing to do.");
    return;
  }

  // wait for enough signatures if the signing service is still catching up
  let sigs = [];
  for (let i = 0; i < 24; i++) {
    sigs = (await (await fetch(`${BRIDGE_API}/bridge/signatures/${btx}`)).json()).signatures || [];
    if (sigs.length >= required) break;
    console.log(`  waiting for signatures: ${sigs.length}/${required}…`);
    await sleep(5000);
  }
  if (sigs.length < required) { console.error(`Only ${sigs.length}/${required} signatures — cannot release.`); process.exit(1); }

  // 2) reconstruct the signed message and validate + sort signatures ascending by signer
  const msgHash = hre.ethers.utils.keccak256(hre.ethers.utils.solidityPack(
    ["bytes32", "address", "address", "uint256", "uint256", "uint256", "uint256", "address"],
    [btx, token, user, amount, sourceChain, sourceNonce, net.chainId, bridgeAddr]
  ));
  const ethHash = hre.ethers.utils.hashMessage(hre.ethers.utils.arrayify(msgHash));
  const paired = sigs.map((sig) => ({ sig, signer: hre.ethers.utils.recoverAddress(ethHash, sig) }))
    .filter((p) => validators.has(p.signer.toLowerCase()));
  // dedupe by signer, then sort strictly ascending (contract requires signer > lastSigner)
  const bySigner = new Map();
  for (const p of paired) bySigner.set(p.signer.toLowerCase(), p);
  const ordered = [...bySigner.values()].sort((a, b) =>
    a.signer.toLowerCase() < b.signer.toLowerCase() ? -1 : 1);
  if (ordered.length < required) { console.error(`Only ${ordered.length} valid distinct validator sigs — need ${required}.`); process.exit(1); }
  const finalSigs = ordered.slice(0, required).map((p) => p.sig);
  console.log(`\nSubmitting ${finalSigs.length} signatures (ascending): ${ordered.slice(0, required).map((p) => p.signer.slice(0, 8)).join(", ")}`);

  // 3) submit releaseTokens
  const tx = await bridge.releaseTokens(token, user, amount, sourceChain, sourceNonce, btx, finalSigs, { gasLimit: 400_000 });
  console.log(`releaseTokens tx: ${tx.hash}`);
  const rcpt = await tx.wait();
  console.log(`  mined in block ${rcpt.blockNumber}, status ${rcpt.status}`);
  if (rcpt.status !== 1) { console.error("Release tx reverted."); process.exit(1); }
  console.log("\n✅ RELEASE EXECUTED.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

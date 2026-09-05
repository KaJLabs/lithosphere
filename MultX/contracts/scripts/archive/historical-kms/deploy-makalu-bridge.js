/**
 * Deploy the hardened MultXBridge on Lithosphere MAKALU (EVM chainId 700777)
 * and register the 10 Makalu LEP100 tokens as supported.
 *
 * This mirrors scripts/02-redeploy-bridge-hardened.js (Kamet) but uses the
 * Makalu token set. It is ROUTE-INDEPENDENT: it only deploys the bridge and
 * whitelists tokens (the lock side). Cross-chain routing (which chain releases,
 * wrapped-token pairs, bridge-api `chainsToWatch`) is wired separately once the
 * destination is decided — see docs/integrations/MAKALU_MULTX_DEPLOY_HANDOFF.md.
 *
 * Prerequisites:
 *   - DEPLOYER_PRIVATE_KEY funded on Makalu (≈0.5 LITHO is plenty; the canonical
 *     LEP100 deployer 0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF held 500 LITHO
 *     on Makalu as of 2026-06-16).
 *   - Validator signing addresses. RECOMMENDED: reuse the Kamet hardened set so
 *     the existing bridge-api / KMS signs Makalu releases with no new keys:
 *       VALIDATOR_0_ADDRESS=0xA5BD41d5325A0462873c813D9f377f6C8BE52DEd
 *       VALIDATOR_1_ADDRESS=0xDC3cB79A773617f24dF1FB249D38E59b91Fa2B0D
 *       VALIDATOR_2_ADDRESS=0x94625372007f90ebB570E363de57d3a5340C27de
 *
 * Usage:
 *   DEPLOYER_PRIVATE_KEY=0x... \
 *   VALIDATOR_0_ADDRESS=0x... VALIDATOR_1_ADDRESS=0x... VALIDATOR_2_ADDRESS=0x... \
 *   npx hardhat run scripts/deploy-makalu-bridge.js --network litho_makalu
 */

throw new Error('Archived KMS-era script: execution is forbidden');
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Canonical Makalu LEP100 token addresses (700777-2), each verified on-chain
// via symbol() over https://rpc.litho.ai on 2026-06-16. NOTE: QTT is Kamet-only,
// so Makalu has 10 tokens (not the 11 on Kamet).
const MAKALU_TOKENS = {
  wLITHO: "0x599a7E135f1790ae117b4EdDc0422D24Bc766161",
  LitBTC: "0xC4645CA5411D6E27556780AB4cdd0DF7e609df74",
  LAX:    "0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d",
  JOT:    "0xEF2f35f6d0fb7DC9E87b8ca8252AE2E6ffb2a25e",
  COLLE:  "0x10D4BB600c96e9243E2f50baFED8b2478F25af61",
  IMAGE:  "0xAcD98E323968647936887aD4934e64B01060727e",
  AGII:   "0x10052B8ccD2160b8F9880C6b4F5DD117fF253B1c",
  BLDR:   "0x798eD6bFc5bfCFc60938d5098825b354427A0786",
  FGPT:   "0x151ef362eA96853702Cc5e7728107e3961fbD22e",
  MUSA:   "0xDB829befCF8E582379E2c034FA2589b8D2EA1c5D",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await deployer.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("  MAKALU — HARDENED MULTXBRIDGE DEPLOYMENT");
  console.log("=".repeat(60));
  console.log(`Network:  ${hre.network.name} (Chain ID ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  if (network.chainId !== 700777) {
    console.error(
      `ERROR: expected Makalu chainId 700777, got ${network.chainId}. ` +
      `Run with --network litho_makalu.`
    );
    process.exit(1);
  }

  const balance = await deployer.getBalance();
  console.log(`Balance:  ${hre.ethers.utils.formatEther(balance)} LITHO\n`);
  if (balance.isZero()) {
    console.error("ERROR: Deployer has 0 balance on Makalu. Fund the account first.");
    process.exit(1);
  }

  // Validator addresses from env (VALIDATOR_0_ADDRESS … VALIDATOR_9_ADDRESS)
  const validatorAddresses = [];
  for (let i = 0; i < 10; i++) {
    const addr = process.env[`VALIDATOR_${i}_ADDRESS`];
    if (!addr) break;
    validatorAddresses.push(addr);
  }
  if (validatorAddresses.length === 0) {
    console.error(
      "ERROR: No validator addresses found.\n" +
      "Set VALIDATOR_0_ADDRESS, VALIDATOR_1_ADDRESS, VALIDATOR_2_ADDRESS in env.\n" +
      "Reuse the Kamet hardened set so the existing bridge-api signs Makalu."
    );
    process.exit(1);
  }

  const signaturesRequired = Math.ceil((validatorAddresses.length * 2) / 3); // 2/3+1
  console.log(`Validators (${validatorAddresses.length}, threshold ${signaturesRequired}):`);
  validatorAddresses.forEach((v, i) => console.log(`  Validator ${i}: ${v}`));

  // Deploy
  console.log("\n--- Deploying Hardened MultXBridge ---");
  const MultXBridge = await hre.ethers.getContractFactory("MultXBridge");
  const bridge = await MultXBridge.deploy(validatorAddresses, signaturesRequired, { gasLimit: 6_000_000 });
  await bridge.deployed();
  console.log(`  MultXBridge (Makalu): ${bridge.address}`);

  // Register tokens
  console.log("\n--- Adding supported tokens ---");
  const tokenAddresses = Object.values(MAKALU_TOKENS);
  for (const [symbol, address] of Object.entries(MAKALU_TOKENS)) {
    try {
      const tx = await bridge.addSupportedToken(address, { gasLimit: 100_000 });
      await tx.wait();
      console.log(`  Added ${symbol} (${address})`);
    } catch (err) {
      console.error(`  Failed to add ${symbol}: ${err.message}`);
    }
  }

  // Save record
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) fs.mkdirSync(deploymentDir, { recursive: true });

  const deploymentInfo = {
    network: hre.network.name,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: { MultXBridge: bridge.address, tokens: MAKALU_TOKENS },
    bridge: {
      validators: validatorAddresses,
      signaturesRequired,
      supportedTokens: tokenAddresses,
      dailyCaps: "all unlimited (0) — set via setDailyCap() if needed",
    },
  };
  const deploymentFile = path.join(deploymentDir, `makalu-bridge-${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  fs.writeFileSync(path.join(deploymentDir, "makalu-bridge-latest.json"), JSON.stringify(deploymentInfo, null, 2));

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`  MultXBridge (Makalu):   ${bridge.address}`);
  console.log(`  Validators:             ${validatorAddresses.length} (${signaturesRequired}-of-${validatorAddresses.length})`);
  console.log(`  Supported tokens:       ${tokenAddresses.length}`);
  console.log(`  Saved to:               ${deploymentFile}`);
  console.log();
  console.log("  >>> SEND THIS BRIDGE ADDRESS BACK so the backend + SDK preset can be wired:");
  console.log(`  >>> ${bridge.address}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

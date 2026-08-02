const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment...");

  const [deployer, validator1, validator2, validator3] = await hre.ethers.getSigners();

  console.log(`Deploying from: ${deployer.address}`);

  // 1. Deploy MockERC20
  console.log("\n1. Deploying MockERC20...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const lithoToken = await MockERC20.deploy("Lithosphere", "LITHO", 18);
  await lithoToken.deployed();
  console.log(`   MockERC20 deployed at: ${lithoToken.address}`);

  // 2. Deploy MultXBridge
  console.log("\n2. Deploying MultXBridge...");
  const validators = [validator1.address, validator2.address, validator3.address];
  const signaturesRequired = 2;

  const MultXBridge = await hre.ethers.getContractFactory("MultXBridge");
  const bridge = await MultXBridge.deploy(validators, signaturesRequired);
  await bridge.deployed();
  console.log(`   MultXBridge deployed at: ${bridge.address}`);

  // 3. Add supported token
  console.log("\n3. Adding LITHO as supported token...");
  const addTx = await bridge.addSupportedToken(lithoToken.address);
  await addTx.wait();
  console.log(`   LITHO token added to bridge`);

  // 4. Save deployment info
  const network = hre.network.name;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentFile = path.join(__dirname, `../deployments/${network}-${timestamp}.json`);

  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    validators,
    signaturesRequired,
    contracts: {
      MockERC20: lithoToken.address,
      MultXBridge: bridge.address
    }
  };

  // Create deployments directory if it doesn't exist
  const deploymentDir = path.dirname(deploymentFile);
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n4. Deployment info saved to: ${deploymentFile}`);

  // 5. Print summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`\nValidators (${validators.length}):`);
  validators.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
  console.log(`\nSignatures Required: ${signaturesRequired}`);
  console.log(`\nContract Addresses:`);
  console.log(`  MULTX_BRIDGE_ADDRESS=${bridge.address}`);
  console.log(`  LITHO_TOKEN_ADDRESS=${lithoToken.address}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

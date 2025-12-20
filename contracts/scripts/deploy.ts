import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy LITHONative (which inherits from Lep100)
  const LITHONative = await ethers.getContractFactory("LITHONative");
  const lithoNative = await LITHONative.deploy();
  await lithoNative.waitForDeployment();
  const lithoAddress = await lithoNative.getAddress();
  console.log("LITHONative deployed to:", lithoAddress);

  // Deploy WLITHO wrapper
  const WLITHO = await ethers.getContractFactory("WLITHO");
  const wlitho = await WLITHO.deploy(lithoAddress);
  await wlitho.waitForDeployment();
  const wlithoAddress = await wlitho.getAddress();
  console.log("WLITHO deployed to:", wlithoAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("LITHONative:", lithoAddress);
  console.log("WLITHO:", wlithoAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

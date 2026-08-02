const hre = require("hardhat");
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const token = new hre.ethers.Contract("0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2",
    ["function approve(address,uint256) returns (bool)"], deployer);
  const bridge = new hre.ethers.Contract("0x95B646bF6629A379AD898DC58D011fd3111e5700",
    ["function lockTokens(address,uint256,uint256)",
     "function nonce() view returns (uint256)",
     "event TokensLocked(bytes32 indexed, address indexed, address indexed, uint256, uint256, uint256)"], deployer);
  const amt = hre.ethers.utils.parseEther("10");
  console.log("Approving...");
  await (await token.approve("0x95B646bF6629A379AD898DC58D011fd3111e5700", amt, {gasLimit:100000})).wait();
  console.log("Locking 10 wLITHO → Sepolia...");
  const tx = await bridge.lockTokens("0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2", amt, 11155111, {gasLimit:300000});
  const r = await tx.wait();
  console.log("TX:", tx.hash);
  console.log("Block:", r.blockNumber, "Status:", r.status);
  console.log("Nonce:", (await bridge.nonce()).toString());
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});

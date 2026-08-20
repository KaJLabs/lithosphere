require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

const deploymentApproved = process.env.DNNS_DEPLOYMENT_APPROVED === "true";
const deployerPrivateKey = process.env.DNNS_DEPLOYER_PRIVATE_KEY;

if (deployerPrivateKey && !deploymentApproved) {
  throw new Error(
    "DNNS_DEPLOYER_PRIVATE_KEY was supplied without DNNS_DEPLOYMENT_APPROVED=true"
  );
}

const deployerAccounts = deploymentApproved && deployerPrivateKey
  ? [deployerPrivateKey]
  : [];

module.exports = {
  solidity: {
    compilers: [
      { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
      { version: "0.8.17", settings: { optimizer: { enabled: true, runs: 200 } } },
    ],
  },
  networks: {
    litho_kamet: {
      url: process.env.KAMET_RPC_HTTP || "https://rpc-3.litho.ai",
      chainId: 900523,
      accounts: deployerAccounts,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_HTTP || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: deployerAccounts,
    },
    bnb_testnet: {
      url: process.env.BNB_TESTNET_RPC_HTTP || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: deployerAccounts,
    },
    base_sepolia: {
      url: process.env.BASE_SEPOLIA_RPC_HTTP || "https://sepolia.base.org",
      chainId: 84532,
      accounts: deployerAccounts,
    },
  },
};

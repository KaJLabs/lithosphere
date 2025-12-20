import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
// NOTE: Uncomment the line below if you have Foundry installed
// import '@nomicfoundation/hardhat-foundry';
import '@nomicfoundation/hardhat-verify';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import 'dotenv/config';

// Environment variables with defaults
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
const DEVNET_RPC_URL = process.env.DEVNET_RPC_URL || 'http://localhost:8545';
const STAGING_RPC_URL = process.env.STAGING_RPC_URL || 'https://staging.lithosphere.network/rpc';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || '';

const config: HardhatUserConfig = {
  // Solidity Configuration
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: 'paris',
    },
  },

  // Default Network
  defaultNetwork: 'hardhat',

  // Network Configurations
  networks: {
    // Local Development (Hardhat Node)
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
      gas: 'auto',
      gasPrice: 'auto',
      mining: {
        auto: true,
        interval: 0,
      },
    },

    // Local Development (External Node - e.g., Foundry Anvil)
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
      accounts: [PRIVATE_KEY],
    },

    // Devnet (CI/CD Ephemeral Environment)
    devnet: {
      url: DEVNET_RPC_URL,
      chainId: 1000, // Lithosphere Devnet Chain ID
      accounts: [PRIVATE_KEY],
      gasPrice: 'auto',
      gas: 'auto',
      verify: {
        etherscan: {
          apiUrl: 'https://devnet-explorer.lithosphere.network/api',
        },
      },
    },

    // Staging (Persistent Testnet)
    staging: {
      url: STAGING_RPC_URL,
      chainId: 1001, // Lithosphere Staging Chain ID
      accounts: [PRIVATE_KEY],
      gasPrice: 'auto',
      gas: 'auto',
      verify: {
        etherscan: {
          apiUrl: 'https://staging-explorer.lithosphere.network/api',
        },
      },
    },
  },

  // Named Accounts for hardhat-deploy
  namedAccounts: {
    deployer: {
      default: 0, // First account is deployer
      devnet: 0,
      staging: 0,
    },
    admin: {
      default: 1,
      devnet: 1,
      staging: 1,
    },
  },

  // Paths Configuration (Compatible with Foundry)
  paths: {
    sources: './contracts',
    tests: './test/hardhat',
    cache: './cache',
    artifacts: './artifacts',
    deploy: './deploy',
    deployments: './deployments',
  },

  // TypeChain Configuration
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
    alwaysGenerateOverloads: false,
    externalArtifacts: ['node_modules/@openzeppelin/contracts/build/**/*.json'],
  },

  // Gas Reporter Configuration
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    coinmarketcap: COINMARKETCAP_API_KEY,
    outputFile: process.env.CI ? 'gas-report.txt' : undefined,
    noColors: process.env.CI === 'true',
    excludeContracts: ['test/', 'mocks/'],
  },

  // Etherscan Verification
  etherscan: {
    apiKey: {
      devnet: ETHERSCAN_API_KEY,
      staging: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'devnet',
        chainId: 1000,
        urls: {
          apiURL: 'https://devnet-explorer.lithosphere.network/api',
          browserURL: 'https://devnet-explorer.lithosphere.network',
        },
      },
      {
        network: 'staging',
        chainId: 1001,
        urls: {
          apiURL: 'https://staging-explorer.lithosphere.network/api',
          browserURL: 'https://staging-explorer.lithosphere.network',
        },
      },
    ],
  },

  // Mocha Configuration for Tests
  mocha: {
    timeout: 60000, // 60 seconds
    parallel: false,
  },
};

export default config;

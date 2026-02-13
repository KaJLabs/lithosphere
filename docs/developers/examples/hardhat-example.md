# Hardhat Example

> **Work in Progress** -- This guide provides a starting point for developing smart contracts with Hardhat on the Lithosphere network. Full examples and detailed walkthroughs will be added as the `@lithosphere/contracts` package matures.

---

## Overview

The `@lithosphere/contracts` package uses Hardhat as the primary smart contract development framework. It includes the following contracts:

| Contract | Description |
|----------|-------------|
| **LITHO** | Native blockchain token contract |
| **LEP100** | Multi-chain token standard implementation |
| **WLITHO** | Wrapped LITHO token implementation |
| **Lep100Access** | Access control for LEP100 operations |

All contracts are written in **Solidity 0.8.20+** and are compiled, tested, and deployed using Hardhat.

---

## Basic Setup

### Initialize a New Project

```bash
# Create a new directory
mkdir my-litho-contracts
cd my-litho-contracts

# Initialize npm
npm init -y

# Install Hardhat
npm install --save-dev hardhat

# Initialize Hardhat project
npx hardhat init
```

Select "Create a TypeScript project" when prompted. This generates a project structure with sample contracts, tests, and configuration.

### Install Dependencies

```bash
# Core dependencies
npm install --save-dev @nomicfoundation/hardhat-toolbox typescript ts-node

# OpenZeppelin contracts (commonly used as base contracts)
npm install @openzeppelin/contracts
```

---

## Hardhat Configuration

Create or modify `hardhat.config.ts` to include the Lithosphere network:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Local development network
    hardhat: {
      chainId: 31337,
    },
    // Lithosphere testnet
    lithoTestnet: {
      url: process.env.LITHO_RPC_URL || "https://testnet-rpc.lithosphere.network",
      chainId: 61,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
    // Lithosphere mainnet
    lithoMainnet: {
      url: "https://mainnet-rpc.lithosphere.network",
      chainId: 61,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
```

---

## Compiling Contracts

```bash
# Compile all contracts
npx hardhat compile
```

Compiled artifacts are output to the `artifacts/` directory and type information to `typechain-types/`.

---

## Running Tests

```bash
# Run all tests
npx hardhat test

# Run tests in parallel for faster execution
npx hardhat test --parallel

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run a specific test file
npx hardhat test test/LEP100.test.ts
```

---

## Deploying Contracts

### Deploy to Local Hardhat Network

```bash
# Start a local Hardhat node in one terminal
npx hardhat node

# Deploy in another terminal
npx hardhat run scripts/deploy.ts --network localhost
```

### Deploy to Lithosphere Testnet

```bash
# Set your deployer private key
export DEPLOYER_PRIVATE_KEY=0x...

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network lithoTestnet
```

### Deploy to Lithosphere Mainnet

```bash
# Set your deployer private key
export DEPLOYER_PRIVATE_KEY=0x...

# Deploy to mainnet (use with caution)
npx hardhat run scripts/deploy.ts --network lithoMainnet
```

---

## Gas Reporting

Install the gas reporter plugin to monitor gas consumption:

```bash
npm install --save-dev hardhat-gas-reporter
```

Add to `hardhat.config.ts`:

```typescript
import "hardhat-gas-reporter";

// Add to config object:
gasReporter: {
  enabled: true,
  currency: "USD",
},
```

---

## Security Analysis

Run Slither for static analysis of your contracts:

```bash
# Install Slither
pip install slither-analyzer

# Run analysis
slither .
```

For more comprehensive security testing, see the [Foundry Example](foundry-example.md) for fuzz testing with Forge.

---

## Further Reading

- [Smart Contracts](../smart-contracts.md) -- Lithosphere smart contract architecture and DeFi features
- [LEP100 Token Standard](../lep100-standard.md) -- Details on the LEP100 standard implemented by these contracts
- [Foundry Example](foundry-example.md) -- Complementary testing with Foundry
- [CI/CD Guide](../ci-cd-guide.md) -- Automated contract compilation and testing in the CI pipeline

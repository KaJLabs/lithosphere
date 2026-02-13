# Foundry Example

> **Work in Progress** -- This guide provides a starting point for using Foundry (Forge) for smart contract testing on the Lithosphere network. Full examples will be added as the contract suite grows.

---

## Overview

Foundry is used alongside Hardhat in the Lithosphere development stack as defined in ADR-002 (Technology Stack). While Hardhat serves as the primary TypeScript-native development framework, Foundry provides fast fuzz testing through Forge.

| Tool | Role in Lithosphere |
|------|---------------------|
| **Forge** | Fast compilation and fuzz testing of Solidity contracts |
| **Cast** | Command-line tool for interacting with deployed contracts |
| **Anvil** | Local testnet node (alternative to Hardhat Network) |

---

## Basic Setup

### Install Foundry

```bash
# Install Foundryup (the Foundry installer)
curl -L https://foundry.paradigm.xyz | bash

# Install/update Foundry tools
foundryup
```

This installs `forge`, `cast`, and `anvil`.

### Initialize a Foundry Project

```bash
# Create a new Foundry project
forge init my-litho-foundry
cd my-litho-foundry
```

This generates the following structure:

```
my-litho-foundry/
├── src/              # Solidity source files
├── test/             # Solidity test files
├── script/           # Deployment scripts
├── lib/              # Dependencies (git submodules)
└── foundry.toml      # Configuration
```

### Configure for Lithosphere

Edit `foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
litho_testnet = "https://testnet-rpc.lithosphere.network"
litho_mainnet = "https://mainnet-rpc.lithosphere.network"
```

---

## Building Contracts

```bash
# Compile all contracts
forge build

# Force recompile
forge build --force

# Build with sizes displayed
forge build --sizes
```

---

## Running Tests

### Standard Tests

```bash
# Run all tests
forge test

# Run with verbosity for more output
forge test -vvv

# Run a specific test file
forge test --match-path test/LEP100.t.sol

# Run a specific test function
forge test --match-test testTransfer
```

### Fuzz Testing

Fuzz testing is a key reason Foundry is included in the Lithosphere stack. Forge automatically fuzzes any test function that takes parameters:

```solidity
// test/LEP100.t.sol
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract LEP100Test is Test {
    // This test is automatically fuzzed with random uint256 values
    function testFuzzTransfer(uint256 amount) public {
        // Bound the amount to a reasonable range
        amount = bound(amount, 1, 1e18);
        // ... test logic
    }
}
```

Run fuzz tests with a high number of runs for thorough coverage:

```bash
# Run fuzz tests with 10,000 iterations
forge test --fuzz-runs 10000
```

This is the same configuration used in the Lithosphere CI pipeline for contract auditing.

---

## Security Analysis

### Slither Static Analysis

Run Slither and output results in SARIF format for integration with CI tools:

```bash
# Install Slither
pip install slither-analyzer

# Run analysis with SARIF output
slither . --sarif output.sarif

# Run standard analysis
slither .
```

### Contract CI Pipeline

The full contract audit pipeline used in the Lithosphere CI (from ADR-002):

```bash
# 1. Compile with Hardhat
hardhat compile

# 2. Run Hardhat tests in parallel
hardhat test --parallel

# 3. Run Foundry fuzz tests
forge test --fuzz-runs 10000

# 4. Static analysis with Slither
slither . --sarif output.sarif

# 5. Deep analysis with Mythril
mythril analyze contracts/*.sol
```

---

## Gas Snapshots

Foundry can generate gas snapshots for tracking gas usage over time:

```bash
# Generate a gas snapshot
forge snapshot

# Compare against a previous snapshot
forge snapshot --diff
```

---

## Deploying with Forge

```bash
# Deploy to Lithosphere testnet
forge script script/Deploy.s.sol --rpc-url litho_testnet --broadcast

# Deploy to mainnet (use with caution)
forge script script/Deploy.s.sol --rpc-url litho_mainnet --broadcast --verify
```

---

## Further Reading

- [Hardhat Example](hardhat-example.md) -- Primary development framework with TypeScript support
- [Smart Contracts](../smart-contracts.md) -- Lithosphere smart contract architecture
- [CI/CD Guide](../ci-cd-guide.md) -- How Foundry fits into the automated pipeline
- [Foundry Book](https://book.getfoundry.sh/) -- Official Foundry documentation

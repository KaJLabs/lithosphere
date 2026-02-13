# Testing Best Practices

This guide covers the testing toolchain, CI pipeline configuration, security auditing tools, and environment-specific testing strategies for the Lithosphere project.

## Smart Contract Testing Toolchain

Lithosphere uses a dual toolchain approach for smart contract testing:

### Hardhat (v2.19+)

- **TypeScript-native development** -- Write tests and deployment scripts in TypeScript.
- **Hardhat Ignition** -- Declarative deployment system for reproducible contract deployments.
- **hardhat-gas-reporter** -- Gas usage reporting for optimization during test runs.
- **Parallel test execution** -- Run tests concurrently for faster feedback.

### Foundry (Forge)

- **Fast fuzz testing** -- Property-based testing with high throughput.
- **Configurable fuzz runs** -- Default 10,000 fuzz runs in CI for thorough coverage.
- **Solidity-native tests** -- Write tests directly in Solidity for lower-level control.

## Contract CI Pipeline

The CI pipeline for smart contracts runs the following steps in order:

```bash
# 1. Compile contracts
hardhat compile

# 2. Run Hardhat tests in parallel
hardhat test --parallel

# 3. Run Foundry fuzz tests
forge test --fuzz-runs 10000

# 4. Static analysis with Slither
slither . --sarif output.sarif

# 5. Symbolic execution with Mythril
mythril analyze contracts/*.sol
```

## Security Auditing Tools

| Tool     | Type                          | Purpose |
|----------|-------------------------------|---------|
| Slither  | Static analysis               | Detect common vulnerabilities, code quality issues, and optimization opportunities. |
| Mythril  | Symbolic execution            | Deep analysis of contract bytecode for security vulnerabilities. |
| Echidna  | Property-based testing/fuzzing | Fuzz testing with user-defined invariants to find edge cases. |
| Certora  | Formal verification (optional) | Mathematically prove contract properties hold for all inputs. |

## Testing Strategy by Environment

| Environment | Test Type           | Details |
|-------------|---------------------|---------|
| Local       | Unit tests          | Fast iteration with hot-reload. Run individual test files during development. |
| Devnet      | CI ephemeral testing | Automated tests on short-lived environments with seeded fixtures. |
| Staging     | Integration testing  | Full integration tests against a persistent testnet with realistic data. |
| Mainnet     | Smoke tests         | Post-deployment verification with minimal, non-destructive checks. |

## General Best Practices

- **Test edge cases** -- Cover boundary conditions, zero values, overflow/underflow, and reentrancy scenarios.
- **Use deterministic fixtures** -- Seed test data consistently to ensure reproducible results.
- **Run security scans in CI** -- Never skip Slither or container scanning in the pipeline.
- **Fuzz test critical financial logic** -- Any function handling token transfers, staking, or governance must be fuzz tested.
- **Isolate tests** -- Each test should be independent and not rely on state from other tests.

## Version Pinning Policy

| Component       | Strategy       | Version         |
|-----------------|---------------|-----------------|
| Solidity        | Exact version  | 0.8.20          |
| Node.js Runtime | LTS            | 20              |
| Security Tools  | Latest stable  | Updated regularly |

## Dependency Update Policy

| Cadence   | Scope             | Method         |
|-----------|-------------------|----------------|
| Weekly    | Security patches  | Dependabot (automated) |
| Monthly   | Minor versions    | Manual review  |
| Quarterly | Major versions    | RFC required   |

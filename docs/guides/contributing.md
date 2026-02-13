# Contributing to Lithosphere

Welcome to the Lithosphere project! We appreciate your interest in contributing. This guide will help you get started with the development workflow, code standards, and contribution process.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/lithosphere.git
   cd lithosphere
   ```
3. **Install dependencies:**
   ```bash
   pnpm install
   ```
4. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

Use the following commands during development:

```bash
# Install all dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Start local development server with hot-reload
pnpm dev
```

## Code Standards

- **TypeScript** -- All application code is written in TypeScript. Ensure proper typing and avoid `any` where possible.
- **ESLint + Prettier** -- Code is linted with ESLint and formatted with Prettier. Run linting before submitting:
  ```bash
  pnpm lint
  ```
- **Follow existing patterns** -- When adding new functionality, follow the conventions and patterns already established in the codebase.

## Smart Contract Contributions

- Use **Solidity 0.8.20+** for all contract code.
- Develop and test contracts using **Hardhat**.
- Run security scans before submitting:
  ```bash
  # Compile contracts
  hardhat compile

  # Run tests
  hardhat test --parallel

  # Run Slither static analysis
  slither .
  ```
- Include unit tests for all new contract functionality.
- Document any changes to contract interfaces or ABIs.

## Documentation Contributions

When contributing to documentation, please ensure:

- **Clear and concise writing** -- Use straightforward language and avoid unnecessary jargon.
- **Proper Markdown formatting** -- Follow standard Markdown conventions. Use headers, code blocks, and tables appropriately.
- **Technical accuracy** -- Verify all commands, code snippets, and configuration values are correct.
- **Up-to-date information** -- Ensure documentation reflects the current state of the codebase.

## Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** and commit them with clear, descriptive messages.
3. **Run all tests** to verify nothing is broken:
   ```bash
   pnpm test
   ```
4. **Submit a pull request** on GitHub with a clear description of:
   - What changes were made
   - Why the changes are needed
   - How the changes were tested

## Commit Conventions

- Use clear, descriptive commit messages.
- Prefix commits with a type: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Keep commits focused -- one logical change per commit.
- Examples:
  ```
  feat: add token transfer validation
  fix: resolve race condition in block indexer
  docs: update deployment guide with new environment variables
  chore: upgrade Hardhat to v2.20
  ```

## Code Review

- All pull requests require at least one review before merging.
- **Mainnet-affecting changes require 2 approvals** from designated reviewers.
- Address all review feedback before requesting a re-review.
- Keep pull requests focused and reasonably sized for efficient review.

## Issue Reporting

Use **GitHub Issues** to report bugs, request features, or ask questions:

- Search existing issues before creating a new one to avoid duplicates.
- Provide clear reproduction steps for bug reports.
- Include environment details (OS, Node.js version, pnpm version) when relevant.

## Community

- **Website:** [litho.ai](https://litho.ai)
- **Research Lab:** [KaJLabs.org](https://kajlabs.org)

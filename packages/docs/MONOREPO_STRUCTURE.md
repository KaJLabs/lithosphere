# Lithosphere Monorepo Structure

## Overview

The repository has been reorganized into a clean monorepo structure that separates documentation from product code.

## New Structure

```
lithosphere/
├── packages/
│   ├── blockchain-core/          # Core blockchain implementation
│   │   ├── src/
│   │   │   ├── contracts/        # Smart contracts (LEP100, DeFi, etc.)
│   │   │   ├── sdk/              # TypeScript/JavaScript SDK
│   │   │   ├── chain/            # Blockchain core implementation
│   │   │   ├── consensus/        # Linear Communication BFT
│   │   │   ├── crypto/           # MDKM, ring signatures, etc.
│   │   │   └── index.ts          # Main entry point
│   │   ├── test/                 # Test files
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── docs/                     # All documentation
│       ├── documentation/        # Whitepaper, technical specs
│       ├── locked-account-generation-scheme/
│       ├── current-lithosphere-features/
│       ├── litho-chain/
│       ├── .gitbook/
│       ├── *.md files           # All markdown documentation
│       ├── *.pdf files          # PDF documents
│       ├── package.json
│       └── README.md
│
├── apps/                         # (Future) Application packages
├── infra/                        # (Future) Infrastructure as Code
├── tooling/                      # (Future) Build tooling
│
├── .github/                      # GitHub workflows
├── package.json                  # Root package configuration
├── pnpm-workspace.yaml          # Workspace configuration
├── turbo.json                   # Turborepo configuration
├── tsconfig.json                # Root TypeScript config
├── .eslintrc.js                 # ESLint configuration
├── .prettierrc                  # Prettier configuration
├── .gitignore                   # Git ignore rules
└── README.md                    # Main README
```

## Packages

### @lithosphere/blockchain-core

**Location**: `packages/blockchain-core/`

Core blockchain implementation containing:

- Smart contracts (LEP100 token standard, DeFi protocols)
- TypeScript/JavaScript SDK for developers
- Blockchain core implementation
- Consensus mechanism (Linear Communication BFT)
- Cryptographic utilities (MDKM, ring signatures, threshold signatures)

**Status**: Scaffold created, ready for implementation

**Key directories**:

- `src/contracts/` - Smart contract implementations
- `src/sdk/` - Developer SDK
- `src/chain/` - Core blockchain logic
- `src/consensus/` - Consensus mechanism
- `src/crypto/` - Cryptographic utilities

### @lithosphere/docs

**Location**: `packages/docs/`

Comprehensive documentation including:

- Whitepaper and technical specifications
- LEP100 token standard documentation
- Architecture and design documents
- Smart contract guides
- API documentation

**Status**: All existing documentation migrated

## Development Workflow

### Installation

```bash
pnpm install
```

### Build all packages

```bash
pnpm build
```

### Run tests

```bash
pnpm test
```

### Lint and format

```bash
pnpm lint
pnpm format
```

### Work on specific package

```bash
# Navigate to package
cd packages/blockchain-core

# Run package-specific commands
pnpm build
pnpm test
```

## Workspace Configuration

The monorepo uses:

- **pnpm workspaces** for package management
- **Turborepo** for build orchestration
- **TypeScript** for type safety
- **ESLint + Prettier** for code quality

## Next Steps

### For Product Development

1. **Implement Smart Contracts** (`packages/blockchain-core/src/contracts/`)
   - LEP100 token standard
   - DeFi protocols
   - Governance contracts

2. **Build SDK** (`packages/blockchain-core/src/sdk/`)
   - Blockchain client
   - Wallet integration
   - Transaction builders

3. **Develop Chain Logic** (`packages/blockchain-core/src/chain/`)
   - Block structures
   - Transaction handling
   - State management

4. **Implement Consensus** (`packages/blockchain-core/src/consensus/`)
   - Linear Communication BFT
   - Validator management
   - Block production

5. **Add Cryptography** (`packages/blockchain-core/src/crypto/`)
   - MDKM implementation
   - Ring signatures
   - Threshold signatures

### For Infrastructure

- Add application packages to `apps/`
- Add infrastructure code to `infra/`
- Add shared tooling to `tooling/`

## Migration Summary

### Files Moved

- ✅ All `.md` files → `packages/docs/`
- ✅ `documentation/` folder → `packages/docs/documentation/`
- ✅ `locked-account-generation-scheme/` → `packages/docs/locked-account-generation-scheme/`
- ✅ `current-lithosphere-features/` → `packages/docs/current-lithosphere-features/`
- ✅ `litho-chain/` → `packages/docs/litho-chain/`
- ✅ `.gitbook/` → `packages/docs/.gitbook/`
- ✅ PDF and DOCX files → `packages/docs/`

### Files Created

- ✅ `packages/blockchain-core/package.json`
- ✅ `packages/blockchain-core/tsconfig.json`
- ✅ `packages/blockchain-core/README.md`
- ✅ `packages/blockchain-core/src/` structure
- ✅ `packages/docs/package.json`
- ✅ `packages/docs/README.md`
- ✅ Root `.gitignore`
- ✅ Updated root `README.md`

### Configuration Updated

- ✅ `pnpm-workspace.yaml` - Already configured for packages structure
- ✅ `package.json` - Root configuration maintained
- ✅ `turbo.json` - Build configuration ready

## Benefits

1. **Clear Separation**: Documentation and code are cleanly separated
2. **Scalability**: Easy to add new packages (smart contracts, SDKs, apps)
3. **Developer Experience**: Clear structure, fast builds with Turborepo
4. **Maintainability**: Each package has its own dependencies and configuration
5. **CI/CD Ready**: Turborepo enables efficient incremental builds

## Resources

- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

# Lithosphere

> **Lithosphere L1 Blockchain Developer Infrastructure**

A next-generation Layer 1 blockchain platform with advanced DeFi capabilities, privacy-preserving smart contracts, and the LEP100 multi-chain token standard.

## 🏗️ Monorepo Structure

This repository uses pnpm workspaces and Turborepo for efficient monorepo management.

```
lithosphere/
├── api/                    # GraphQL API server
├── indexer/               # Blockchain event indexer
├── contracts/             # Smart contracts (Solidity)
├── web/                   # Next.js frontend application
├── packages/
│   ├── blockchain-core/   # Core blockchain SDK & utilities
│   ├── create-litho-app/  # CLI tool for scaffolding projects
│   └── docs/              # Documentation & technical specs
├── clusters/              # Kubernetes configurations (devnet, staging, mainnet)
├── infra/                 # Infrastructure as Code & monitoring
├── scripts/               # Deployment & utility scripts
└── templates/             # Project templates for developers
```

## 📦 Packages & Applications

### Applications

#### [@lithosphere/api](./api)
GraphQL API server providing:
- Blockchain data querying and indexing
- Smart contract interactions
- Real-time event subscriptions
- Express.js + Apollo Server

#### [@lithosphere/indexer](./indexer)
Blockchain event indexer that:
- Indexes on-chain events from Lithosphere network
- Provides GraphQL schema for efficient querying
- Powers the API backend

#### [@lithosphere/contracts](./contracts)
Smart contracts including:
- **LITHO**: Native blockchain token
- **LEP100**: Multi-chain token standard
- **WLITHO**: Wrapped token implementation
- **Lep100Access**: Access control contracts
- Built with Lithic + Hardhat + Solidity

#### [@lithosphere/web](./web)
Frontend application built with:
- Next.js 14 for server-side rendering
- React 18 for UI components
- Real-time blockchain data integration
- Responsive design

### Shared Packages

#### [@lithosphere/blockchain-core](./packages/blockchain-core)
Core SDK providing:
- Ledger abstraction layer
- Cryptographic utilities (MDKM, ring signatures)
- Consensus mechanism implementation
- TypeScript-first API

#### [create-litho-app](./packages/create-litho-app)
CLI tool for scaffolding new Lithosphere projects:
- Project template selection
- Automatic dependency setup
- Built with tsup for optimal bundling

#### [@lithosphere/docs](./packages/docs)
Comprehensive documentation including:
- Whitepaper and technical specifications
- LEP100 token standard guide
- Architecture documentation
- Smart contract development guides

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

### Development Commands

```bash
pnpm build              # Build all packages with Turborepo
pnpm test              # Run all tests
pnpm lint              # Lint all packages
pnpm lint:fix          # Fix linting issues
pnpm typecheck         # Type check all TypeScript
pnpm format            # Format code with Prettier
pnpm clean             # Clean build artifacts

# Application-specific development
pnpm dev               # Run all dev servers in parallel
pnpm dev:api          # Run API server only
pnpm dev:web          # Run web frontend only
```

## 🔑 Key Features

- **LEP100 Token Standard**: Multi-chain compatible token standard
- **Privacy-Preserving**: Ring signatures and locked account generation scheme
- **DeFi Ready**: Built-in smart contracts for decentralized finance
- **High Performance**: Linear Communication BFT consensus
- **Developer Friendly**: Comprehensive SDK and tooling
- **Secure**: Myriad Distributed Key Management (MDKM)

## 📖 Documentation

For detailed documentation, see the [docs package](./packages/docs):
- Technical specifications and architecture
- LEP100 token standard
- Smart contract development guides
- API documentation
- Development guides

## 🛠️ Technology Stack

**Core:**
- **Consensus**: Custom Linear Communication BFT
- **Smart Contracts**: Solidity (EVM-compatible)
- **Cryptography**: MDKM, Ring Signatures, Threshold Signatures

**Backend:**
- **Runtime**: Node.js >= 20.0.0
- **Language**: TypeScript
- **API**: Apollo Server (GraphQL)
- **Database**: PostgreSQL
- **Monorepo**: pnpm + Turborepo

**Frontend:**
- **Framework**: Next.js 14
- **UI**: React 18
- **Styling**: TBD

**Tooling:**
- **Package Manager**: pnpm (v9.0.0+)
- **Testing**: Jest
- **Linting**: ESLint
- **Code Formatting**: Prettier
- **Smart Contract Dev**: Hardhat
- **Container Orchestration**: Docker & Kubernetes

**Infrastructure:**
- **Observability**: Prometheus, Grafana, Loki
- **Monitoring**: cAdvisor, Node Exporter, Alertmanager
- **Deployment**: Kubernetes + ArgoCD
- **Log Collection**: Promtail

## 🚢 Deployment

### Local Development with Docker

The repository includes comprehensive Docker Compose configuration for local development:

```bash
# Start all core services
docker compose up -d

# Start with monitoring stack (Prometheus + Grafana)
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

**Services Include:**
- 🔗 API (GraphQL)
- ⛓️ Blockchain Indexer
- 📊 PostgreSQL Database
- 📈 Prometheus (Metrics)
- 📊 Grafana (Dashboards - http://localhost:3000)
- 📝 Loki (Log Aggregation)
- 🚚 Promtail (Log Collection)
- 🔔 Alertmanager (Alert Routing)

### Production Deployment

Deploy to Kubernetes clusters (devnet, staging, mainnet):

```bash
# Configuration structure
clusters/
  ├── devnet/    # Development cluster
  ├── staging/   # Staging cluster
  └── mainnet/   # Production cluster
```

Environment setup:

```bash
# Set required environment variables
export DATABASE_URL=postgres://user:password@host/db
export LITHO_CHAIN_ID=61        # Network identifier
export LITHO_RPC_URL=http://...  # Node RPC endpoint

# Deploy with kubectl
kubectl apply -kustomization clusters/{devnet,staging,mainnet}/
```


## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines (coming soon).

## 📄 License

[Add your license here]

## 🔗 Links

- Website: https://litho.ai
- Documentation: https://docs.litho.ai
- Discord: [Coming soon]
- Wavy: [Coming soon]

---

Built with ❤️ by the Lithosphere team

# Lithosphere

> **Lithosphere L1 Blockchain Developer Infrastructure**

A next-generation Layer 1 blockchain platform with advanced DeFi capabilities, privacy-preserving smart contracts, and the LEP100 multi-chain token standard.

## 🏗️ Monorepo Structure

This repository uses pnpm workspaces for efficient monorepo management.

```
lithosphere/
├── packages/
│   ├── blockchain-core/    # Core blockchain implementation, smart contracts & SDK
│   └── docs/              # Documentation, whitepapers & technical specs
├── apps/                   # (Future) Application packages
├── infra/                 # (Future) Infrastructure as Code
└── tooling/               # (Future) Build tooling and shared configs
```

## 📦 Packages

### [@lithosphere/blockchain-core](./packages/blockchain-core)
Core blockchain implementation including:
- LEP100 token standard smart contracts
- JavaScript/TypeScript SDK
- Consensus mechanism (Linear Communication BFT)
- Cryptographic utilities (MDKM, ring signatures)

### [@lithosphere/docs](./packages/docs)
Comprehensive documentation including:
- Whitepaper and technical specifications
- LEP100 token standard documentation
- Smart contract guides
- Architecture and design documents

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
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm lint:fix       # Fix linting issues
pnpm typecheck      # Type check TypeScript
pnpm format         # Format code with Prettier
pnpm clean          # Clean build artifacts
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
- [Whitepaper](./packages/docs/documentation/whitepaper.md)
- [LEP100 Token Standard](./packages/docs/lep100-token-standard.md)
- [Architecture](./packages/docs/lithosphere-architecture-and-technology.md)
- [Smart Contracts](./packages/docs/smart-contracts-and-decentralized-finance-defi.md)

## 🛠️ Technology Stack

- **Blockchain**: Custom L1 implementation
- **Smart Contracts**: Solidity / CosmWasm (Rust)
- **SDK**: TypeScript
- **Consensus**: Linear Communication BFT
- **Cryptography**: MDKM, Ring Signatures, Threshold Signatures
- **Build Tools**: Turborepo, pnpm workspaces

## 🚢 Deployment

### Local Development with Docker

```bash
# Start all services locally
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Environment Configuration

Copy the appropriate environment file before deployment:

```bash
# For testnet
cp .env.testnet .env

# Edit .env with your configuration
nano .env
```

### Production Deployment

The CI/CD pipeline automatically deploys to the target environment when:
1. Code is pushed to `main` branch
2. The Release workflow completes successfully
3. SLSA signatures are verified

**Required GitHub Secrets:**
- `VPS_HOST` - Target server hostname/IP
- `VPS_USER` - SSH username
- `VPS_SSH_PRIVATE_KEY` - SSH private key for authentication
- `DATABASE_URL` - PostgreSQL connection string
- `LITHO_RPC_URL` - Blockchain RPC endpoint
- `LITHO_CHAIN_ID` - Chain ID (61 for testnet)

### Health Checks

Verify deployment status:

```bash
# Run health check script
./scripts/health-check.sh localhost 4000 9090

# Or manually check endpoints
curl http://localhost:4000/health
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' \
  http://localhost:4000/graphql
```

### Docker Compose Profiles

```bash
# Core services only (default)
docker compose up -d

# With monitoring (Prometheus + Grafana)
docker compose --profile monitoring up -d

# With reverse proxy (Traefik)
docker compose --profile proxy up -d

# With contract deployment
docker compose --profile contracts up -d

# All services
docker compose --profile monitoring --profile proxy up -d
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines (coming soon).

## 📄 License

[Add your license here]

## 🔗 Links

- Website: [Coming soon]
- Documentation: [Coming soon]
- Discord: [Coming soon]
- Twitter: [Coming soon]

---

Built with ❤️ by the Lithosphere team

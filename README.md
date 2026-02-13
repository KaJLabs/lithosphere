# Lithosphere

> Making Smart Contracts Intelligent for the Digital Economy

Lithosphere is a next-generation Layer 1 blockchain platform with advanced DeFi capabilities, privacy-preserving smart contracts, and the LEP100 multi-chain token standard. Powered by AI, deep learning, and LinBFT consensus.

---

## Documentation

Browse the full documentation at the **[Lithosphere Docs Site](/)** or navigate by section:

| Section | Description |
|---------|-------------|
| [Introduction](docs/introduction/what-is-lithosphere.md) | What is Lithosphere, architecture overview, glossary, FAQ |
| [Quickstart](docs/quickstart/dev-setup.md) | Developer setup, validator setup, CLI tools |
| [Developers](docs/developers/overview.md) | LEP100 standard, smart contracts, API & SDK, CI/CD guide |
| [Validators](docs/validators/node-deployment.md) | Node deployment, monitoring, security, upgrades |
| [Network](docs/network/chain-parameters.md) | Chain parameters, tokenomics, governance, roadmap |
| [API Reference](docs/api-reference/rest-api.md) | REST API, GraphQL API, SDK reference |
| [Guides](docs/guides/security-checklist.md) | Security checklist, testing, deployment, contributing |

## Key Features

- **LEP100 Token Standard** -- Multi-chain compatible token standard supporting fungible and non-fungible tokens
- **Cross-Chain Interoperability** -- Connect all blockchains through Myriad Distributed Key Management (MDKM)
- **Intelligent Smart Contracts** -- First blockchain to integrate Deep Neural Networks (DNNs)
- **High Performance** -- Up to 1M TPS with LinBFT consensus, ~3s block time
- **Privacy-Preserving** -- Ring signatures and locked account generation scheme
- **EVM Compatible** -- Deploy existing Ethereum smart contracts without modification

## Repository Structure

```
lithosphere/
├── docs/                  # Documentation site content
│   ├── introduction/      # What is Lithosphere, architecture, glossary
│   ├── quickstart/        # Developer and validator setup guides
│   ├── developers/        # LEP100, smart contracts, API, CI/CD
│   ├── validators/        # Node deployment, monitoring, security
│   ├── network/           # Chain parameters, tokenomics, governance
│   ├── api-reference/     # REST, GraphQL, SDK reference
│   ├── guides/            # Security, testing, deployment, contributing
│   └── diagrams/          # Architecture diagrams and images
├── static/                # Docsify theme assets (CSS, JS, images)
├── index.html             # Docsify entry point
├── _sidebar.md            # Documentation navigation
├── Makulu/                # Testnet environment (complete monorepo)
│   ├── api/               # GraphQL API server (Express + Apollo)
│   ├── contracts/         # Smart contracts (LITHO, LEP100, WLITHO)
│   ├── indexer/           # Blockchain event indexer
│   ├── web/               # Next.js 14 frontend
│   ├── packages/          # Shared packages (blockchain-core, docs)
│   ├── clusters/          # Kubernetes configs (devnet, staging, mainnet)
│   ├── infra/             # Infrastructure as Code & monitoring
│   └── docs/              # Architecture ADRs & governance
└── .github/               # CI/CD workflows
```

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Development

```bash
# Clone the repository
git clone https://github.com/KaJLabs/lithosphere.git
cd lithosphere

# Install dependencies
cd Makulu
pnpm install

# Build all packages
pnpm build

# Run development servers
pnpm dev
```

### Local Documentation Preview

```bash
# From the repo root
npx docsify-cli serve .
```

Then open [http://localhost:3000](http://localhost:3000) to browse the docs.

### Docker Development

```bash
cd Makulu

# Start core services
docker compose up -d

# Start with monitoring (Prometheus + Grafana)
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Consensus | LinBFT (Linear-communication BFT) |
| Smart Contracts | Solidity (EVM-compatible) |
| Cryptography | MDKM, Ring Signatures, Threshold Signatures |
| Runtime | Node.js 20, TypeScript |
| API | Apollo Server (GraphQL) |
| Frontend | Next.js 14, React 18 |
| Infrastructure | Kubernetes, ArgoCD, Terraform |
| Observability | Prometheus, Grafana, Loki |

## Community

- [litho.ai](https://litho.ai/)
- [ecosystem.litho.ai](https://ecosystem.litho.ai)
- [KaJLabs.org](https://kajlabs.org)
- [Whitepaper](https://whitepaper.litho.ai)

## Contributing

We welcome contributions! See the [Contributing Guide](docs/guides/contributing.md) for details.

## License

See LICENSE file for details.

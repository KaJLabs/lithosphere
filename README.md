# Lithosphere Blockchain Platform

This repository contains the Lithosphere blockchain infrastructure organized into environment-specific directories.

## Repository Structure

```
.
├── .github/           # CI/CD workflows and GitHub configuration
├── Makulu/            # Testnet environment (complete monorepo)
│   ├── api/           # API services
│   ├── contracts/     # Smart contracts
│   ├── docs/          # Documentation
│   ├── indexer/       # Blockchain indexer
│   ├── packages/      # Shared packages
│   ├── templates/     # Project templates
│   ├── web/           # Web applications
│   ├── clusters/      # Kubernetes cluster configs
│   ├── infra/         # Infrastructure as Code
│   └── package.json   # Monorepo configuration
└── README.md          # This file
```

## Environments

### Makulu (Testnet)
The `Makulu` directory contains the complete testnet environment including all services, contracts, and infrastructure configurations.

To work with the testnet environment:

```bash
cd Makulu
pnpm install
pnpm dev
```

## Development

Each environment is a self-contained Turborepo monorepo. Refer to the respective environment's README for specific development instructions.

## License

See LICENSE file in each environment directory.

# Developer Setup Guide

This guide walks you through setting up a local Lithosphere development environment, including prerequisites, installation, available commands, and running services with Docker.

---

## Prerequisites

Before you begin, ensure the following tools are installed on your system:

| Tool       | Minimum Version | Notes                                      |
|------------|----------------:|---------------------------------------------|
| **Node.js** | >= 20           | LTS release recommended                    |
| **pnpm**    | >= 9            | Fast, disk-efficient package manager        |
| **Docker**  | latest          | Required only for local service development |

> **Tip:** You can install pnpm globally with `npm install -g pnpm` or use Corepack which ships with Node.js 16+:
> ```bash
> corepack enable
> corepack prepare pnpm@latest --activate
> ```

---

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/KaJLabs/lithosphere.git
cd lithosphere
pnpm install
```

Build all packages, run the test suite, and start the development server:

```bash
pnpm build
pnpm test
pnpm dev
```

If all three commands complete without errors, your environment is ready.

---

## Development Commands

The monorepo provides the following commands at the root level. All commands are run via `pnpm`.

| Command            | Description                                                        |
|--------------------|--------------------------------------------------------------------|
| `pnpm build`       | Build all packages and applications for production.                |
| `pnpm test`        | Run the full test suite across the monorepo.                       |
| `pnpm lint`        | Run the linter to check for code style and quality issues.         |
| `pnpm lint:fix`    | Run the linter and automatically fix any fixable issues.           |
| `pnpm typecheck`   | Run TypeScript type checking across all packages.                  |
| `pnpm format`      | Format source files using the configured formatter (Prettier).     |
| `pnpm clean`       | Remove all build artifacts, caches, and `node_modules` directories.|
| `pnpm dev`         | Start all development servers concurrently (API + Web).            |
| `pnpm dev:api`     | Start only the API development server.                             |
| `pnpm dev:web`     | Start only the Web frontend development server.                    |

---

## Local Development with Docker

### Starting Core Services

Use Docker Compose to spin up the core service stack:

```bash
docker compose up -d
```

This starts the essential services required for local development.

### Starting with the Monitoring Stack

To include the full monitoring and observability stack, use both compose files:

```bash
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d
```

### Services Overview

The Docker Compose environment provides the following services:

| Service                 | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| **API (GraphQL)**       | The primary backend API exposing a GraphQL endpoint for client consumption. |
| **Blockchain Indexer**  | Indexes on-chain data and stores it in PostgreSQL for fast querying.        |
| **PostgreSQL**          | Relational database backing the API and Indexer.                            |
| **Prometheus**          | Metrics collection and time-series database.                               |
| **Grafana**             | Dashboards and visualization. Available at `http://localhost:3000`.         |
| **Loki**                | Log aggregation system, integrated with Grafana for log queries.           |
| **Promtail**            | Log shipping agent that forwards container logs to Loki.                   |
| **Alertmanager**        | Alert routing and notification management for Prometheus alerts.           |

> **Note:** Grafana is accessible at [http://localhost:3000](http://localhost:3000) once the monitoring stack is running. Default credentials are typically `admin` / `admin`.

### Stopping Services

```bash
# Stop core services
docker compose down

# Stop core + monitoring services
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml down
```

---

## Environment Variables

The following environment variables are used to configure the development environment. You can set them in a `.env` file at the project root or export them in your shell.

| Variable           | Default / Example                          | Description                                                |
|--------------------|--------------------------------------------|------------------------------------------------------------|
| `DATABASE_URL`     | `postgresql://user:pass@localhost:5432/litho` | PostgreSQL connection string used by the API and Indexer.  |
| `LITHO_CHAIN_ID`   | `61`                                       | The chain ID for the Lithosphere network.                  |
| `LITHO_RPC_URL`    | `http://localhost:26657`                   | RPC endpoint URL for connecting to a Lithosphere node.     |

Example `.env` file:

```env
DATABASE_URL=postgresql://litho:litho@localhost:5432/lithosphere
LITHO_CHAIN_ID=61
LITHO_RPC_URL=http://localhost:26657
```

---

## Next Steps

- [Validator Setup](quickstart/validator-setup.md) -- Run a validator node locally or on a network.
- [CLI Tools Reference](quickstart/cli-tools.md) -- Explore the `lithod` binary and `create-litho-app` scaffolding tool.

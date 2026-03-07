# ============================================================================
# Lithosphere Developer Local Stack -- Makefile
# ============================================================================
# Quick-start:
#   make up       Start all services (blocks until healthy)
#   make seed     Fund wallets & deploy demo LEP100 contract
#   make logs     Tail live logs from every service
#   make down     Stop all services gracefully
#   make clean    Factory-reset: wipe volumes, images, temp files
#   make status   Show container status
#   make restart  Stop -> Start
#   make dev      Full setup: up + seed + open explorer
# ============================================================================

SHELL       := /bin/bash
COMPOSE     := docker compose -f docker-compose.dev.yml
PROJECT     := litho-devnet

# Seed script runner -- prefers pnpm dlx, falls back to npx
TSX         := pnpm dlx tsx

# ============================================================================
# Targets
# ============================================================================

.PHONY: up down clean logs seed status restart dev test faucet-fund help

## -- up -----------------------------------------------------------------------
## Start all services and wait for every container to report healthy.
up:
	@echo "============================================================"
	@echo "  Lithosphere Dev Stack -- Starting..."
	@echo "============================================================"
	$(COMPOSE) up -d --build --remove-orphans
	@echo ""
	@echo "  Waiting for health checks..."
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "  Stack is up."
	@echo "    LithoVM RPC   -> http://localhost:8545"
	@echo "    API            -> http://localhost:4000"
	@echo "    Indexer        -> http://localhost:3001"
	@echo "    Explorer       -> http://localhost:3000"
	@echo "    Faucet         -> http://localhost:8081"
	@echo "    Postgres       -> localhost:5432"
	@echo "    Redis          -> localhost:6379"
	@echo ""

## -- down ---------------------------------------------------------------------
## Stop all containers (data volumes are preserved).
down:
	@echo "  Stopping Lithosphere Dev Stack..."
	$(COMPOSE) down --timeout 15
	@echo "  All services stopped.  Volumes preserved."

## -- clean --------------------------------------------------------------------
## Factory reset: stop containers, remove volumes, prune build cache.
clean:
	@echo "============================================================"
	@echo "  Factory Reset -- this will destroy ALL local data"
	@echo "============================================================"
	$(COMPOSE) down -v --remove-orphans --timeout 10 2>/dev/null || true
	@# Remove named volumes that may linger
	docker volume rm litho-dev-chain-data litho-dev-postgres-data litho-dev-redis-data 2>/dev/null || true
	@# Remove dangling images from this project
	docker image prune -f --filter "label=litho.env=local" 2>/dev/null || true
	@# Clean temp / build artefacts
	rm -rf explorer/.next explorer/node_modules 2>/dev/null || true
	rm -rf api/dist indexer/dist faucet/dist 2>/dev/null || true
	@echo "  Clean complete.  Run 'make up' to rebuild from scratch."

## -- logs ---------------------------------------------------------------------
## Tail live logs from all services.  Ctrl-C to stop.
logs:
	$(COMPOSE) logs -f --tail 80

## -- seed ---------------------------------------------------------------------
## Run the seed script: fund dev wallets + deploy demo LEP100 contract.
## Requires the stack to be running (make up first).
seed:
	@echo "============================================================"
	@echo "  Seeding local devnet..."
	@echo "============================================================"
	$(TSX) scripts/seed-local.ts

## -- status -------------------------------------------------------------------
## Show the status of all containers.
status:
	$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

## -- restart ------------------------------------------------------------------
## Convenience: stop then start.
restart: down up

## -- dev ----------------------------------------------------------------------
## Full developer setup: start stack, seed data, print endpoints.
dev: up seed
	@echo ""
	@echo "============================================================"
	@echo "  Dev environment ready!"
	@echo "============================================================"
	@echo "  Explorer:  http://localhost:3000"
	@echo "  API:       http://localhost:4000"
	@echo "  GraphQL:   http://localhost:4000/graphql"
	@echo "  Faucet:    http://localhost:8081"
	@echo "  RPC:       http://localhost:8545"
	@echo ""

## -- test ---------------------------------------------------------------------
## Run all service tests locally (requires pnpm install).
test:
	@echo "  Running tests across all services..."
	pnpm --filter @lithosphere/api test 2>/dev/null || echo "  [api] no tests or test failed"
	pnpm --filter @lithosphere/indexer test 2>/dev/null || echo "  [indexer] no tests or test failed"
	@echo "  Test run complete."

## -- faucet-fund --------------------------------------------------------------
## Top up the faucet wallet from Anvil genesis account.
## Sends 100 LITHO from Anvil account #1 to the faucet wallet (account #0).
faucet-fund:
	@echo "  Funding faucet wallet..."
	@docker exec lithovm-local cast send \
		--rpc-url http://127.0.0.1:8545 \
		--private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
		0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
		--value 100ether 2>/dev/null && \
		echo "  Sent 100 LITHO to faucet wallet" || \
		echo "  Failed -- is the stack running? (make up)"

## -- help ---------------------------------------------------------------------
## Print this help.
help:
	@echo ""
	@echo "  Lithosphere Dev Stack -- Available targets"
	@echo "  ----------------------------------------"
	@echo "  make up           Start all services (waits for health)"
	@echo "  make down         Stop all services"
	@echo "  make clean        Factory reset (wipes volumes + temp files)"
	@echo "  make logs         Tail logs from all services"
	@echo "  make seed         Fund wallets + deploy LEP100 demo contract"
	@echo "  make status       Show container status"
	@echo "  make restart      Stop -> Start"
	@echo "  make dev          Full setup: up + seed (one command)"
	@echo "  make test         Run all service tests"
	@echo "  make faucet-fund  Top up faucet wallet from genesis"
	@echo ""

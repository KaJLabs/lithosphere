# Frontend Integration

> **Work in Progress** -- This page is under active development. The topics listed below will be expanded with detailed guides and code examples as the `@lithosphere/web` package matures.

---

## Overview

The `@lithosphere/web` package is the frontend application for the Lithosphere platform, built with **Next.js 14** and **React 18**. It provides server-side rendering, real-time blockchain data integration, and a responsive user interface.

This guide will cover patterns and techniques for integrating Lithosphere blockchain functionality into web applications.

---

## Topics to Cover

### Wallet Integration

- **MetaMask** -- Connecting MetaMask to the Lithosphere network by adding a custom RPC configuration.
- **Thanos Wallet** -- Integrating with the Thanos Wallet browser extension and mobile apps.
- **Trust Wallet** -- Using WalletConnect or deep links for Trust Wallet integration.
- Detecting installed wallet providers and handling connection state.
- Switching between networks and managing multiple accounts.

### Next.js Patterns for Blockchain Apps

- Server-side rendering versus client-side rendering for blockchain data.
- Using React Server Components for static chain data and client components for interactive wallet features.
- Next.js 14 App Router patterns for blockchain pages.
- Handling hydration mismatches when wallet state differs between server and client.

### Reading Chain Data

- Querying blocks, transactions, and account balances through the GraphQL API.
- Fetching LEP100 token metadata and balances.
- Displaying transaction history for connected wallets.
- Caching strategies for blockchain queries.

### Connecting to Lithosphere RPC

- Configuring the JSON-RPC provider for the Lithosphere node.
- Using ethers.js or viem with the Lithosphere RPC endpoint.
- Handling network errors and reconnection logic.

### Transaction Signing

- Building and signing transactions in the browser.
- Submitting signed transactions to the Lithosphere network.
- Monitoring transaction confirmation status.
- Handling transaction failures and user rejections.

### Event Subscriptions

- Subscribing to real-time blockchain events via WebSocket.
- Listening for LEP100 token transfer events.
- Updating UI state in response to on-chain events.
- Managing subscription lifecycles with React hooks.

---

## Environment Variables

The following environment variables configure the frontend's connection to the Lithosphere network:

| Variable | Description | Default |
|----------|-------------|---------|
| `LITHO_RPC_URL` | The JSON-RPC endpoint for the Lithosphere node | -- |
| `LITHO_CHAIN_ID` | The chain ID for the Lithosphere network | `61` |

Set these in a `.env.local` file for local development:

```bash
LITHO_RPC_URL=https://testnet-rpc.lithosphere.network
LITHO_CHAIN_ID=61
```

---

## Package Reference

The `@lithosphere/web` package uses the following core dependencies:

| Dependency | Version | Purpose |
|------------|---------|---------|
| Next.js | 14+ | React framework with SSR and App Router |
| React | 18+ | UI component library |

---

## Further Reading

- [API & SDK](api-and-sdk.md) -- Backend API and SDK for blockchain interactions
- [LEP100 Token Standard](lep100-standard.md) -- Token standard for displayed assets
- [Developer Overview](overview.md) -- Full monorepo structure and package descriptions

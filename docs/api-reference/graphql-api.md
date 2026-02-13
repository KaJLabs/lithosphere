# GraphQL API Reference

> **Work in Progress** -- This document is under active development. Some schemas and details may change.

## Overview

The Lithosphere GraphQL API is built with **Apollo Server v4+** and serves as the primary GraphQL gateway for querying blockchain data, interacting with smart contracts, and subscribing to real-time events on the Lithosphere network.

## Features

- **Blockchain data querying and indexing** -- Query blocks, transactions, accounts, and token balances.
- **Smart contract interactions** -- Read contract state and submit transactions through GraphQL mutations.
- **Real-time event subscriptions** -- Subscribe to on-chain events via GraphQL subscriptions for live updates.

## Endpoint

The GraphQL API is typically available at:

```
/graphql
```

In development mode, a **GraphQL Playground** is available at the same endpoint, allowing you to explore the schema, build queries interactively, and inspect documentation.

## Local Development

Start the GraphQL server locally using:

```bash
pnpm dev:api
```

This launches the Apollo Server with hot-reload enabled. The GraphQL Playground will be accessible at `http://localhost:<port>/graphql`.

## SubQuery Indexer

The GraphQL backend is powered by a **SubQuery indexer** that indexes on-chain events from the Lithosphere network. The indexer processes blocks and transactions, storing structured data in PostgreSQL for efficient querying through the GraphQL layer.

## Example Query

```graphql
query GetBlockInfo {
  block(number: 12345) {
    hash
    number
    timestamp
    transactions {
      hash
      from
      to
      value
    }
  }
}
```

```graphql
query GetAccountBalance {
  account(address: "0x...") {
    balance
    nonce
    transactions(first: 10) {
      hash
      value
      timestamp
    }
  }
}
```

> **Note:** The schema above is illustrative. The full schema will be documented once it is finalized.

## Further Reading

Detailed schema documentation, mutation references, and subscription guides are coming soon.

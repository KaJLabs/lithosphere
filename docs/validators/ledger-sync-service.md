# Ledger Sync Service

> **Work in Progress** -- This page is under active development. Content will be expanded as implementation details are finalized.

---

## Topics to Cover

The following topics will be documented in this guide:

### Sync Modes

- **Fast Sync** -- Rapidly catch up to the current chain height by downloading and verifying blocks in parallel without replaying all transactions.
- **Full Sync** -- Replay every block from genesis to reconstruct the complete chain state. Provides the highest level of verification but takes significantly longer.

### Genesis Sync Process

Step-by-step process for syncing a new node from the genesis block, including genesis file retrieval, peer configuration, and expected sync timelines.

### Snapshot-based Sync

Using state snapshots to bootstrap a node to a recent chain height without replaying historical blocks. Covers snapshot providers, verification of snapshot integrity, and restore procedures.

### State Pruning Strategies

Configuration options for managing on-disk state growth:

- **Default pruning** -- Retains recent state only.
- **Nothing** -- Retains all historical state (archive node).
- **Everything** -- Aggressive pruning for minimal disk usage.
- **Custom** -- Fine-grained control over pruning intervals and kept versions.

### Peer Discovery

How nodes discover and connect to peers on the Lithosphere network, including seed nodes, persistent peers, and the address book.

### Data Directory Management

Best practices for managing the `~/.lithod/data/` directory, including backup strategies, disk space monitoring, and safe data directory relocation.

---

## Configuration Reference

Sync behavior is primarily controlled through `config.toml`. Key sections include:

- `[statesync]` -- State sync configuration (enable, RPC servers, trust height/hash)
- `[p2p]` -- Peer-to-peer networking (seeds, persistent peers, max connections)
- `[fastsync]` -- Fast sync version selection

Refer to the inline comments in `config.toml` for detailed parameter descriptions.

---

## Related Pages

- [Node Deployment](node-deployment.md) -- Initial node setup and installation

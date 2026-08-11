# LITHO Mainnet Height-1 Message Ceremony

Status: **not required; client selected normal empty-block launch**.

The client instructed us to proceed without a custom height-1 message. No
MetaMask transaction, funded allocation signer, or message placeholder is
required for the launch.

## Preconditions

- Final genesis and its SHA-256 are sealed.
- All three nodes have the matching genesis and fixed-supply binary.
- Public RPC, REST, WebSocket, gRPC, and transaction submission remain closed.
- `consensus_create_empty_blocks` is `true`, allowing normal empty-block
  production from height 1.

The validator wallet cannot fund this transaction because its full `1 LITHO`
allocation is bonded at genesis.

## Launch behavior

1. Start the sentries and sole validator privately at the approved launch time.
2. Confirm Cosmos chain ID `lithosphere_9005-1` and EVM chain ID `9005`.
3. Confirm height 1 is produced normally, including an allowed empty block.
4. Run private chain, peer, RPC, and indexer smoke tests.
5. Only after those checks pass, enable public endpoints and DNS.

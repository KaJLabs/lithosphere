# LITHO L1 R1.1 M03 R2 public evidence summary

Collection timestamp: `2026-09-02T21:34:57.628688Z`

Collection method: credential-free, read-only requests to the published Makalu
EVM, REST, and CometBFT endpoints. No transaction or node mutation occurred.

## Independently reproduced

- EVM chain ID returned `0xab169` (`700777`).
- Cosmos/CometBFT chain ID returned `lithosphere_700777-2`.
- All three setup transaction objects and receipts remain retrievable.
- The ordinary EOA control, harness deployment, and staking authorization each
  have receipt status `0x1`.
- All four authoritative exploit transactions and the retained earlier attempt
  remain retrievable with receipt status `0x0`.
- Each receipt's block header remains retrievable.
- The current harness runtime is 5,520 bytes and has Keccak-256
  `0xdd6fad5fced8d7484cd7902fd6731b8255c7fc7bca2a954faf22a3c01c2957e1`,
  matching the recorded approved harness identity.
- Current total supply remains
  `999998499709400000000000000 ulitho`.
- Current bonded tokens remain
  `50000000000000000000000000 ulitho`.
- The public node reported `catching_up=false` at height `13635108`.

The raw evidence directory contains 44 files. Its `SHA256SUMS.txt` has
SHA-256:
`2495c1ed26a5a438d8e76ac05bda4cf65af84897b3d9d15c22dec0e2fa5536bc`.

## Reproducibility boundary

Historical application-state queries at baseline height `13498831` and final
height `13498855` now return pruned-state errors from both EVM JSON-RPC and
Cosmos REST. Those raw error responses are retained in the collection. The
original height-bound supply, staking-pool, delegation, and harness-balance
outputs must therefore come from evidence retained during the test; they
cannot be regenerated honestly from the current public endpoints.

On-host executable, service, activation, rollback-file, and journal evidence
also requires authorized administrator access and is not claimed by this
public collection.

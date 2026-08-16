# LITHO Mainnet Final Genesis Sealing

The final genesis was sealed for the client-approved launch window
`2026-07-27T17:00:00Z`.

Final genesis SHA-256:
`13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`

Client approval of this exact UTC timestamp was recorded on 2026-07-23.

## Required before sealing

- Approved UTC genesis time: `2026-07-27T17:00:00Z`.
- Fixed-supply binary SHA-256
  `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`.
- Validator consensus public key and all allocation addresses rechecked.
- Internal technical review and client owner approval are recorded in
  `FIXED_SUPPLY_TECHNICAL_REVIEW_2026-07-23.md`. This is not an independent
  third-party audit.
- The encrypted validator identity backup has passed recovery verification.
  Copying it to two offline encrypted locations remains required before launch.

No custom height-1 message is included or required. Launch uses normal
empty-block production as recorded in `FIRST_BLOCK_MESSAGE_CEREMONY.md`.

## Reproduce the seal

Run from Linux/WSL with the pinned binary:

```bash
GENESIS_TIME="YYYY-MM-DDTHH:MM:SSZ" \
LITHOD="/path/to/lithod-mainnet-9005" \
bash scripts/seal_litho_mainnet_9005_genesis.sh
```

The command refuses to overwrite the sealed final genesis. It validates the
chain identity, total supply, disabled inflation, initial validator bond, empty
custom constitution, and binary checksum, then writes `genesis.json.sha256`.

## After sealing

1. Obtain written approval of the final SHA-256.
2. **Complete (2026-07-24):** copy the exact file to all three launch homes
   and verify hashes again.
3. Do not edit the file in place. Any change requires a new sealing ceremony.
4. Run `ansible/playbooks/mainnet-9005-preflight.yml`.
5. Keep public endpoints closed until private height-1 and chain smoke tests
   pass.

## Current gate evidence

On 2026-07-23, the read-only preflight passed the immutable network identity
and node/WireGuard ceremony checks, final genesis/checksum gate, capacity and
disk requirements, VPS-only policy, and pinned-binary checks on all three
hosts. The run completed with zero failures, unreachable hosts, or remote
changes.

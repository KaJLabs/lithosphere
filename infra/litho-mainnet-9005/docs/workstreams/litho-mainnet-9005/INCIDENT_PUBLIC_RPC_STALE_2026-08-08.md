# Public RPC stale-sentry incident — 2026-08-08

## Summary

The public LITHO mainnet RPC stopped advancing at height `1,306,395` with
block time `2026-08-05T02:47:04.813612781Z`. Direct validator inspection on
2026-08-08 showed that consensus had not halted: the validator and second
sentry were current and producing blocks. The public endpoint was terminating
on sentry 1, whose mainnet process was active but wedged in consensus at height
`1,306,396`.

## Recovery

1. Verified the validator and sentry 2 were on Cosmos chain
   `lithosphere_9005-1`, were not catching up, and were advancing.
2. Verified sentry 1 had two expected mainnet peers but its peer states were
   approximately 500,000 blocks ahead of its local state.
3. Restarted only `lithod-mainnet-9005-sentry` on sentry 1. No validator,
   consensus key, genesis, or signing-state change was made.
4. Confirmed sentry 1 entered block-sync mode and advanced continuously.
5. Moved the existing TLS/Nginx public proxy upstream to the healthy sentry 2
   through the checksum- and chain-identity-gated Ansible playbook.
6. Exempted only the isolated production indexer origin from anonymous Nginx
   request/connection accounting. Public limits and the read-only CometBFT
   route allowlist remain enabled.
7. Installed the existing sentry-only stall watchdog on both mainnet sentries
   and pinned its probe to mainnet RPC port `27057`.

Reproducible watchdog deployment is provided by
`ansible/playbooks/mainnet-9005-deploy-sentry-watchdog.yml`.

## Verification

- Public EVM chain ID: `0x232d` (`9005`).
- Public Cosmos chain ID: `lithosphere_9005-1`.
- Public blocks advanced after the proxy change.
- Published genesis SHA-256 remained
  `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`.
- Nginx candidate validation, full configuration validation, TLS-local smoke
  tests, and post-reload chain-identity checks passed.
- Lithoscan production services remained healthy and reported zero
  inconsistent indexed blocks while backlog replay continued.
- Both sentry watchdog timers were enabled and sampled the correct mainnet
  height.

## Follow-up gates

- Keep the public proxy on sentry 2 until sentry 1 reaches the chain tip.
- Confirm Lithoscan lag returns to the normal smoke-test threshold before
  closing the synchronization gate.
- Rotate the previously chat-exposed root password and retain SSH-key-only
  administration.
- Keep Bridge, Swap, Faucet, and MultX disabled until their independent
  production gates pass.

# LITHO mainnet 9005 infrastructure

This directory is the sanitized, audit-visible infrastructure package for:

- EVM chain ID `9005` (`0x232d`)
- Cosmos chain ID `lithosphere_9005-1`
- genesis time `2026-07-27T17:00:00Z`
- approved genesis SHA-256
  `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`

It contains a sanitized mainnet Ansible inventory template and playbooks,
consensus binary patch and build script, public proxy and Lithoscan edge
configuration, deterministic genesis tools, operational verification scripts,
and client/audit runbooks.

## Security boundary

This repository intentionally excludes validator private keys, node private
keys, WireGuard private keys, SSH keys, TLS private keys, mnemonic phrases,
passwords, API tokens, live `.env` files and backup archives. Those remain in
the approved custody and secret-management systems.

The committed inventory is intentionally non-runnable: production host
addresses, WireGuard addressing and peer keys, node IDs, SSH users and key
paths use `REPLACE_WITH_PRIVATE_*` placeholders. Keep the populated inventory
under the ignored `ansible/inventory/mainnet-9005-private/` path or in another
client-controlled private repository. Monitoring and backup workflows receive
production hosts through protected environment secrets rather than source.
The complete classification and operator rules are in
[`docs/PUBLIC_REPOSITORY_BOUNDARY.md`](docs/PUBLIC_REPOSITORY_BOUNDARY.md).

Files under `docs/` are records and runbooks. Commands that mutate a live node
remain subject to the approvals and preflight gates documented there.

## Provenance

- Imported from `BrewCodeDev/lithosphere-dev-infra`
- Source branch: `kamet-mainnet-prep`
- Baseline source commit: `0f72ca43e7ab2ce02c3510258b664937214011e8`
- Import date: `2026-08-02`

The production-specific files created after that baseline were imported from
the reviewed working tree because they had not yet been published to the
personal remote. Their checksums are recorded by the destination commit.

## Current feature locks

Bridge, Swap, Faucet and MultX remain disabled on LITHO mainnet unless a later
audited, approved and immutable release record explicitly enables them.

# Incident: Validator Restart Guard Halt

Status: **resolved and deeply reverified on 2026-07-28**.

## Impact

- The only bonded validator stopped producing blocks after height `16748`.
- Height `16748` was timestamped `2026-07-28T06:52:12.707095028Z`.
- Normal block cadence resumed at height `16750`, timestamped
  `2026-07-28T07:52:07.866629630Z`.
- Both sentries remained healthy, retained identical chain state, and followed
  the validator after recovery.

## Root cause

Ubuntu unattended upgrades updated `libc` and used the package restart
mechanism to stop and start running services at `06:52:13 UTC`. The validator
stopped cleanly, but its CometBFT configuration had:

```toml
double_sign_check_height = 10
```

On every restart, the lookback found the validator's own valid recent commit
signature and refused to start with `found signature from the same key`.
Systemd's `Restart=always` then produced a restart loop. This was a startup
guard false positive, not evidence that two validator processes were signing.

## Controlled recovery

1. Stopped the restart loop.
2. Preserved the pre-change configuration and signing state under
   `/var/backups/litho-mainnet-9005-incident/20260728T0750Z/` on the validator.
3. Verified `priv_validator_state.json` matched the shared halt height `16748`.
4. Changed only `double_sign_check_height` from `10` to `0`.
5. Started the validator once and required consecutive height advancement.
6. Verified both sentries followed with fresh timestamps and
   `catching_up=false`.
7. Ran the full live verifier again.

The recovery is reproducible through
`ansible/playbooks/mainnet-9005-recover-validator-restart.yml`. The durable
inventory value is recorded in
`ansible/inventory/mainnet-9005/group_vars/validators.yml`.

## Verification evidence

The recovery playbook observed advancement from height `16752` to `16775`.
A subsequent public-RPC sample observed sentry 1 advance from `16808` to
`16825` and sentry 2 from `16810` to `16826` in eight seconds.

The full verifier returned `LIVE_VERIFICATION=passed` and reconfirmed:

- Cosmos chain ID `lithosphere_9005-1`;
- EVM chain ID `9005`;
- two peers per node;
- one bonded validator with `1 LITHO`;
- exact fixed supply of `1,000,000,000 LITHO`;
- all seven genesis balances;
- the original height-1 block hash and zero height-1 transactions.

At the end of deep verification, the sequentially observed heights were
validator `16863`, sentry 1 `16890`, and sentry 2 `16916`. The validator
service was active with zero post-recovery restarts.

## Follow-up

- Keep the validator signing state single-writer and preserve it during every
  migration or restore; this is the primary double-sign safety control.
- Alert when no new block is committed for more than two minutes.
- Review unattended-upgrade service restarts and move validator maintenance to
  an explicit window, even though clean restarts now recover automatically.
- Keep indexer synchronization paused only until the backend team consumes the
  post-recovery verification; it may then resume from the existing database.

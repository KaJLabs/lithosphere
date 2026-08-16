# LITHO Fixed-Supply Technical Review

Date: 2026-07-23

## Reviewed artifacts

- Upstream source: Evmos `v20.0.0`
- Upstream commit: `eca13ef2521a9ef13c32e80b1b147230bdb155b5`
- Patch SHA-256:
  `c6ff09423fae76251444633d50134647000e6296bdf29fafaee830def0373f12`
- Mainnet binary SHA-256:
  `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`

## Checks performed

- Confirmed InitChain requires exactly
  `1000000000000000000000000000ulitho`, equal to one billion LITHO at
  18 decimals.
- Confirmed inflation defaults to disabled, parameter validation rejects
  re-enablement, and the inflation keeper receives a mint-restricted bank
  keeper.
- Confirmed the transaction post-handler rejects a completed state whose
  native `ulitho` supply exceeds the permanent ceiling.
- Enumerated production `MintCoins` call sites. Inflation is explicitly
  restricted; EVM balance reconciliation and ERC20 conversion remain
  transaction-scoped and covered by the final-state supply check.
- Confirmed the focused genesis-cap, transaction-cap, and inflation-disable
  tests passed during the reproducible build.
- Confirmed the installed validator binary matches the pinned SHA-256 and
  reports Evmos `v20.0.0` at the expected upstream commit.
- Confirmed the sealed genesis passes the pinned binary's `validate-genesis`
  command.

## Result and boundary

No blocking finding was identified in the internal technical review. The
client supplied written owner approval and authorization to proceed on
2026-07-23.

This document is internal engineering evidence, not an independent third-party
security audit. An external reviewer should still assess the consensus changes
if independent assurance is required by the client's launch policy.

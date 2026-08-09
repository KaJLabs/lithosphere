# LITHO Mainnet 9005 Client Acceptance Checklist

Last reviewed: 2026-07-29

This is a review and signature record, not evidence that unchecked work is
complete. Checked items below mean the repository contains delivery evidence;
they do not substitute for client acceptance.

## A. Delivery evidence

- [x] Final genesis identifies `lithosphere_9005-1` and hashes to
  `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`.
- [x] Approved binary is pinned to SHA-256
  `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`.
- [x] EVM chain ID is `9005` (`0x232d`).
- [x] Supply is exactly `1,000,000,000 LITHO`, with `1 LITHO` initially
  bonded and no additional genesis mint.
- [x] Validator and both sentries launched and passed the full live verifier
  on 2026-07-28.
- [x] Height 1 has the recorded common hash and zero transactions, consistent
  with the approved normal empty-block launch.
- [x] Public TLS EVM RPC, WebSocket, REST, gRPC, read-only CometBFT, and genesis
  endpoints were externally validated at activation.
- [x] A handoff-day public recheck on 2026-07-29 observed advancing blocks,
  both correct chain IDs, the height-1 hash, and the pinned genesis checksum.
- [x] A launch-day validator restart incident was resolved without changing
  genesis or chain state, and the complete verifier passed afterward.
- [x] Two encrypted offline copies of the initial validator identity package
  were client-confirmed.
- [x] Bridge, Swap, Faucet, and MultX remain disabled.
- [x] Lithoscan production cutover, public smoke tests, synchronization
  monitoring, and rollback closeout completed on 2026-07-31.

## B. Client review

- [ ] Verify the network reference and endpoints in
  [CLIENT_HANDOFF_2026-07-29.md](CLIENT_HANDOFF_2026-07-29.md).
- [ ] Reproduce the public health checks in
  [MAINNET_OPERATIONS_RUNBOOK.md](MAINNET_OPERATIONS_RUNBOOK.md).
- [ ] Review the [launch record](LAUNCH_RECORD_2026-07-28.md) and
  [incident record](INCIDENT_2026-07-28_VALIDATOR_RESTART.md).
- [ ] Confirm access to the repository, VPS provider accounts, DNS/Cloudflare,
  certificate administration, and the approved secret exchange system.
- [ ] Confirm at least two authorized operators have independently tested
  key-only access without sharing a private key.
- [ ] Verify both offline validator identity copies remain encrypted,
  separately stored, and recoverable.
- [ ] Confirm the repository contains no credentials or private-key material
  in the files being delivered.

## C. Required owner assignment

KaJ Labs is recorded as the accountable organization for the current handoff.
Individual primary and backup contacts remain to be named in the
client-controlled escalation register. See
[OWNERSHIP_AND_ADMIN_CONTROL_HANDOVER.md](OWNERSHIP_AND_ADMIN_CONTROL_HANDOVER.md)
for the distinction between organizational ownership, operational custody,
and technical controls.

| Responsibility | Primary owner | Backup owner | Target date | Accepted |
|---|---|---|---|---|
| Incident command and 24/7 escalation | KaJ Labs | KaJ Labs | `TBD` | [ ] |
| Validator operations and maintenance approval | KaJ Labs | KaJ Labs | `TBD` | [ ] |
| Consensus-key and signing-state custody | KaJ Labs | KaJ Labs | `TBD` | [ ] |
| DNS, Cloudflare, and certificate renewal | KaJ Labs | KaJ Labs | `TBD` | [ ] |
| Mainnet monitoring and alert routing | KaJ Labs | KaJ Labs | `TBD` | [ ] |
| Lithoscan release and rollback | KaJ Labs | KaJ Labs | `TBD` | [ ] |
| Governance and economic-parameter decisions | KaJ Labs | KaJ Labs | `TBD` | [ ] |

## D. Risk closure or explicit acceptance

For each item, record either closure evidence or the accountable client's
written risk acceptance and review date.

| Risk/gate | Closure or acceptance reference | Owner | Review date | Done |
|---|---|---|---|---|
| Single active validator and no active failover signer | `TBD` | KaJ Labs | `TBD` | [ ] |
| Signing-state backup prepared but protected activation/restore drill pending | `TBD` | KaJ Labs | `TBD` | [ ] |
| Mainnet monitor/rules prepared but protected access and paging route not activated | `TBD` | KaJ Labs | `TBD` | [ ] |
| Raw sentry node ports not yet restricted | `TBD` | KaJ Labs | `TBD` | [ ] |
| Restore, failover, and transaction drills outstanding | `TBD` | KaJ Labs | `TBD` | [ ] |
| Fixed-supply patch lacks independent external review | `TBD` | KaJ Labs | `TBD` | [ ] |
| Allocation labels and remaining economic/governance decisions | `TBD` | KaJ Labs | `TBD` | [ ] |
| EVM chain ID registry acceptance evidence | `TBD` | KaJ Labs | `TBD` | [ ] |
| Lithoscan certificate/Cloudflare/canary cutover | [Cutover record](LITHOSCAN_CUTOVER_READINESS_2026-07-29.md) and [closeout report](lithoscan-window-close.json) | KaJ Labs | 2026-07-31 | [x] |

## E. Handoff decision

Select one:

- [ ] Accepted: base chain and endpoints, with open items tracked under the
  owners and dates above.
- [ ] Accepted: unconditional production operations; every Critical and High
  gate has linked closure evidence.
- [ ] Not accepted: remediation is required before ownership transfer.

Decision notes:

```text
TBD
```

| Signatory | Name and role | Date (UTC) | Signature/reference |
|---|---|---|---|
| Client accountable owner | KaJ Labs (authorized representative `TBD`) | `TBD` | `TBD` |
| Infrastructure delivery owner | `TBD` | `TBD` | `TBD` |
| Security reviewer | `TBD` | `TBD` | `TBD` |

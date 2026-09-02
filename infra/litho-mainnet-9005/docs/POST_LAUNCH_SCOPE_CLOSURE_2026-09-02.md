# LITHO mainnet post-launch closure evidence

Status: **public health, backup controls, infrastructure drift, and EVM
registry closure reverified; external ownership, monitoring acknowledgement,
and final acceptance gates remain open**

This record updates the original mainnet handoff evidence without authorizing
a production configuration change, validator transaction, or feature
activation.

## Public health recheck

At `2026-09-01T19:02:25Z` (`2026-09-02` PKT), credential-free checks returned:

| Check | Result |
| --- | --- |
| EVM JSON-RPC chain ID | `0x232d` (`9005`) |
| Cosmos/CometBFT chain ID | `lithosphere_9005-1` |
| Observed height | `5,844,584` |
| Latest block time | `2026-09-01T19:02:23.228741911Z` |
| Catching up | `false` |
| REST node identity | `lithosphere_9005-1` |
| gRPC TCP reachability | `grpc-mainnet.litho.ai:9090` reachable |
| Published genesis SHA-256 | `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` |

The public result matches the sealed genesis, EVM identity, and Cosmos identity
recorded at launch. This is point-in-time evidence, not a substitute for
continuous monitoring.

## Signing-state backup closure

The former recurring-backup gate is closed by the following merged and passing
evidence:

- PR [#139](https://github.com/KaJLabs/Lithosphere/pull/139) requires two
  distinct public recovery recipients.
- Protected activation run
  [33489075548](https://github.com/KaJLabs/Lithosphere/actions/runs/33489075548)
  passed and produced two independently encrypted ciphertexts plus a manifest.
- Both custodians independently passed offline decryption and content
  validation without writing plaintext key files locally or sharing a recovery
  private key.
- PR [#140](https://github.com/KaJLabs/Lithosphere/pull/140) records the
  dual-recipient recovery evidence.
- Protected scheduled recurrence
  [33505116681](https://github.com/KaJLabs/Lithosphere/actions/runs/33505116681)
  passed, and PR [#141](https://github.com/KaJLabs/Lithosphere/pull/141)
  records the recurring result.

No restore was installed and no second signer was started.

## Private-inventory drift closure

Private infrastructure PR
`KaJLabs/Lithosphere-Production-Infra#16` merged as
`339e9a9acb0b3e10bc0e0ea8ae1d0213f04925c4`. It publishes the reviewed
`mainnet-9005` inventory, the read-only drift playbook, and the desired-state
loopback binding `tcp://127.0.0.1:27057` for raw sentry CometBFT RPC.

Litho Agent (`@lithoagent`) was recorded as the Validator Infra, Chain, and CAB
approver and authorized the read-only drift window. The exact merged playbook
completed against all three nodes with zero unreachable hosts and zero
failures. It found both sentries still listening publicly on raw CometBFT RPC
port `27057`.

During the separately approved controlled remediation window, the sentry-1
Nginx CometBFT upstream was changed from sentry 2's public address to the
co-located `127.0.0.1:27057` listener. Nginx configuration validation passed,
old workers were retired during an approved brief restart, and both sentry RPC
listeners were then changed one at a time to
`tcp://127.0.0.1:27057`. The validator was not restarted.

Final checks observed EVM chain ID `0x232d`, Cosmos chain ID
`lithosphere_9005-1`, `catching_up=false`, reachable gRPC, and block progression
from `5,955,778` to `5,955,784`. A final `--check --diff` run returned
`changed=0`, `unreachable=0`, and `failed=0` on all three nodes. The detailed
private evidence and strengthened runtime checks are in
`KaJLabs/Lithosphere-Production-Infra#17`.

## Canonical EVM registry status

The following were independently rechecked on `2026-09-02` before submission:

- canonical file
  `_data/chains/eip155-9005.json` in
  [`ethereum-lists/chains`](https://github.com/ethereum-lists/chains): absent;
- [`chainid.network/chains.json`](https://chainid.network/chains.json): no
  chain ID `9005` entry;
- open and closed pull-request/issue search in the canonical repository: no
  `9005` submission or acceptance record found.

KaJ Labs then approved the public identity as `Lithosphere Mainnet`, short name
`litho`, native currency `LITHO` with 18 decimals, RPC
`https://rpc-mainnet.litho.ai`, and explorer `https://lithoscan.ai`. The
canonical submission is
[`ethereum-lists/chains#8661`](https://github.com/ethereum-lists/chains/pull/8661),
commit `782156ed2c8b475d9e1112168b06e73a09f3ce2c`.

The external maintainers approved the submission and merged it through their
merge queue on `2026-09-02` as commit `813b938`. Five registry checks passed.
The canonical [`chainid.network/chains.json`](https://chainid.network/chains.json)
aggregate now publishes `Lithosphere Mainnet` with chain and network ID `9005`,
short name `litho`, native currency `LITHO` with 18 decimals, the approved RPC,
and Lithoscan explorer. A same-day EVM JSON-RPC recheck returned `0x232d`.

## Monitoring delivery status

The protected controlled-delivery workflow
[33635711860](https://github.com/KaJLabs/Lithosphere/actions/runs/33635711860)
completed successfully on `2026-09-02`. The read-only three-node progression
check, protected Telegram configuration validation, and Telegram delivery step
all passed. The workflow made no node configuration change or transaction.

The technical delivery test is complete. Final monitoring acceptance remains
open only until primary responder `@lithoagent` and independent backup
responder `@Jkasr` each acknowledge receipt, as required by the alert-delivery
runbook.

## Honest remaining original-scope gates

1. Record independent alert-receipt acknowledgements from primary responder
   `@lithoagent` and independent backup `@Jkasr`. The protected delivery run
   itself has passed; secret values remain protected and are not recorded here.
2. Obtain Autha's focused final release-evidence disposition for the exact L1
   security release identity.
3. Complete the named-owner register and client acceptance/signature section.

MultX activation, post-quantum activation, additional validator onboarding,
and exchange/product integration remain separate workstreams.

# LITHO mainnet post-launch closure evidence

Status: **public health and completed backup controls reverified; external
ownership, registry, drift, and final acceptance gates remain open**

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

## Private-inventory drift preparation

Private infrastructure PR
`KaJLabs/Lithosphere-Production-Infra#16` merged as
`339e9a9acb0b3e10bc0e0ea8ae1d0213f04925c4`. It publishes the reviewed
`mainnet-9005` inventory, the read-only drift playbook, and the desired-state
loopback binding `tcp://127.0.0.1:27057` for raw sentry CometBFT RPC.

No drift check or configuration apply is represented as completed here. The
Validator Infra, Chain, and CAB approvers must be named before the authorized
`--check --diff` run. Any later apply or restart requires a separate approval.

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
[`ethereum-lists/chains#8660`](https://github.com/ethereum-lists/chains/pull/8660),
commit `6e8e05d6a29fe3453430a35a606f9cb04c135d51`.

Submission evidence is now recorded, but registry acceptance remains open
until the external maintainers merge the pull request and the aggregate
registry publishes chain ID `9005`.

## Honest remaining original-scope gates

1. Name the Validator Infra, Chain, and CAB approvers, then run the merged
   read-only drift check.
2. Obtain external maintainer acceptance of the submitted EVM registry entry,
   then retain the merge and aggregate-publication evidence.
3. Record the monitoring responders and alert destination and complete the
   controlled alert-delivery test.
4. Obtain Autha's focused final release-evidence disposition for the exact L1
   security release identity.
5. Complete the named-owner register and client acceptance/signature section.

MultX activation, post-quantum activation, additional validator onboarding,
and exchange/product integration remain separate workstreams.

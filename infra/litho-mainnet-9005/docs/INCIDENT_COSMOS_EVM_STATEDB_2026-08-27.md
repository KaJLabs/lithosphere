# Cosmos EVM StateDB security response — 2026-08-27

Status: **mainnet intentionally paused; forensic snapshot sealed; Makalu validation passed; production restart pending independent approval**

## Reason for the pause

LITHO mainnet was running the Evmos `v20.0.0` application at commit
`eca13ef2521a9ef13c32e80b1b147230bdb155b5`. Its EVM StateDB balance-commit
path did not contain the later Cosmos EVM guard that prohibits EVM commits to
Cosmos SDK module accounts and balance changes to blocked accounts.

No exploit transaction was submitted or reproduced against mainnet. The
decision to pause was precautionary and based on source review, the live
application version, and the live EVM/precompile configuration.

## Coordinated pause

- Validator service stopped: 2026-08-27 at the final block time below.
- Final public/sentry height: `4988061`
- Final block time: `2026-08-27T10:21:14.792504913Z`
- Final block hash:
  `27372B1811A079C118574B8AEAE4DC26BCC8FC0C9CDED06F0338B475722CE9E0`
- Final app hash:
  `FB988261C0C9B7B5BD31EAF710745F6853111DFB65155B392E27E1F0F3B29005`
- Two checks six seconds apart returned the same height and hashes.
- Both non-signing sentries remained online to preserve read access.
- Validator service state after the pause: `inactive`.

The stopped validator had already committed an additional empty block locally at
height `4988062`, but the sentries had not received it before the coordinated
pause. Its block hash is
`CFCDF518C987DCE32657974645A4ACAD3C9D728D978E21A54D2049EADE6F1DE7`;
its data hash is the canonical empty hash, and its transaction count is zero.
The preserved signing state is also at height `4988062`, round 0, step 3. The
candidate replay therefore used the locally committed state at `4988062` and
retained that signing state. It must never be replaced with the older public
height's signing state.

The transaction index reported `total_count: 0`; the mempool reported zero
transactions and zero bytes. This corroborates the client's statement that
mainnet had not yet received user activity. It does not replace independent
application-state and supply reconciliation before resumption.

The frozen REST state reported total supply
`1000000000000000000000000000ulitho`, exactly the permanent one-billion-LITHO
cap, with `1000000000000000000ulitho` bonded and zero unbonded staking-pool
tokens. This supply result must be checked again on the state-clone candidate
and immediately after resumption.

## Forensic evidence

Evidence is retained root-only on the validator under the timestamped incident
directory. The sealed archive contains the validator data directory and signing
state, but not `priv_validator_key.json` or `node_key.json`.

| Artifact | SHA-256 |
|---|---|
| Offline validator data archive | `4cb2562a59360f05baebdef216f08224760e8b8e494b4d87cf7b1c7d365c9172` |
| Paused mainnet binary | `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c` |
| Mainnet genesis | `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f` |

The data archive is approximately 4.3 GB after compression and passed an
immediate `sha256sum -c` verification.

## Remediation candidate

The candidate backports the Cosmos EVM `v0.7.2` StateDB protection semantics
from upstream security-fix commit
`b8d5ed7b126b32f676e820b3aa6b6f00f465a613` to LITHO's pinned Evmos v20
source:

1. every EVM balance commit to an SDK module account fails closed, including an
   apparently unchanged balance;
2. every balance-changing EVM commit to a bank-blocked address fails closed;
3. normal EOA balance commits remain supported;
4. regression tests cover module-account increase, decrease and unchanged
   values, a blocked precompile balance change, and an ordinary EOA.

The guard is additive to the already prepared dependency and fixed-supply
candidate. It is not authorization to restart production.

The complete clean build and focused regression suite passed. The immutable
candidate binary SHA-256 is
`358feb6fc95fbdc4c6f992510e8d0329d3511a17b623e55c61e67b8c6dfff26f`.
Its CycloneDX SBOM SHA-256 is
`1d6cd884f673f69da8e8b0eb614123f5e20ec5cf8cbe858b1cc5fd25cb4d81b1`.

An isolated clone of the paused production state loaded successfully at height
`4988062`. It preserved the Cosmos chain ID `lithosphere_9005-1`, EVM chain ID
`9005`, and the exact one-billion-LITHO supply. The production validator stayed
inactive throughout the replay.

## Makalu validation

The exact candidate binary was rolled through every active
`lithosphere_700777-2` sentry and non-bonded validator before the sole bonded
validator. The bonded-validator pause was observed at height `13031896`; block
production resumed on the candidate and all six nodes reached `catching_up:
false` without a process restart.

At validation height `13031898`, every node returned the same block hash
`4E109D97079FBEEB57295263476F9DAFBA45290027B6E3CB24A56F032A01581E`
and header app hash
`01C5AA3B6256E27379F961F4BBF8BB5156C335B8454A9F054E47816392B959F1`.
The supply response was byte-for-byte equivalent before and after the bonded
validator upgrade. Public RPC reported Cosmos chain ID
`lithosphere_700777-2`, EVM chain ID `700777`, and continuing block production.
No transaction was submitted during this validation.

## Required validation order

1. Clean pinned build and regression tests.
2. State and supply reconciliation at local committed height `4988062`.
3. Makalu deployment with the exact candidate binary. **Passed.**
4. Makalu transaction-free regression, restart, RPC, EVM, Cosmos and invariant
   tests. **Passed.**
5. Binary/SBOM/checksum delivery and independent review.
6. Mainnet sentry rollout and health checks.
7. Mainnet validator rollout with the current signing state; never restore an older
   `priv_validator_state.json`.
8. Resume only after all gates pass, then verify first-block continuity,
   app-hash continuity, supply, validator signing and public APIs.

## Rollback

Retain the paused binary, data archive and current signing state. If the
candidate cannot load height `4988062`, changes state before the next commit,
reports the wrong chain identity, changes total supply, or fails to sign, stop
the service and restore only the prior binary. Never restore older signing
state without the documented double-sign-safe recovery ceremony.

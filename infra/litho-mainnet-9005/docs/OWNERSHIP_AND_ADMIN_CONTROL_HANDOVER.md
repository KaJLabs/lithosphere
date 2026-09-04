# LITHO Mainnet 9005 Ownership and Admin-Control Handover

Last reviewed: 2026-09-04

Accountable organization: **KaJ Labs**. KaJ Labs confirmed Litho Agent
(`@lithoagent`) as primary operational owner and Jkasr (`@Jkasr`) as
independent secondary owner on 2026-09-04. Individual custodians and Safe
signers remain governed by their applicable restricted custody records. An
organization or Safe address does not replace the need for people who can
respond to an incident.

## Named operational owner register

| Role | Assigned owner | Confirmation date |
|---|---|---|
| Primary operational owner | Litho Agent (`@lithoagent`) | 2026-09-04 |
| Independent secondary owner | Jkasr (`@Jkasr`) | 2026-09-04 |

This document defines the operational ownership and technical controls covered
by the handoff. It does not disclose credentials, private keys, recovery
material, or secret-manager values.

## 1. Control model

The handoff uses three separate concepts:

1. **Accountable owner:** KaJ Labs is responsible for approving changes,
   accepting risk, and ensuring the control remains operated.
2. **Operational custodian:** an authorized person or team performs recovery,
   monitoring, deployment, or key-custody procedures.
3. **Technical control:** the actual Safe, key, provider account, IAM role,
   DNS account, SSH credential, or service configuration that authorizes an
   action.

A Safe multisig is appropriate for compatible on-chain treasury and contract
administration. It cannot directly replace a CometBFT consensus key, an SSH
key, a VPS-provider login, a DNS/Cloudflare account, or an on-call owner.

## 2. Ownership and control matrix

| Area | Accountable owner | Control handed over or confirmed | Handoff state | Required client action |
|---|---|---|---|---|
| Mainnet service acceptance and risk decisions | KaJ Labs | Acceptance checklist and evidence package | Delivered for conditional acceptance | Select the handoff decision and record target dates |
| Source repository and deployment automation | KaJ Labs | Repository access and documented Ansible/scripts | Access confirmation pending | Confirm authorized client administrators and branch/release policy |
| Validator VPS administration | KaJ Labs | VPS-provider control plus key-only SSH access | Client access must be confirmed | Retain two independent administrators and remove obsolete access after validation |
| Sentry VPS administration | KaJ Labs | VPS-provider control plus key-only SSH access | Client access must be confirmed | Validate access to both sentries and preserve one-at-a-time maintenance |
| Validator consensus signing | KaJ Labs | Encrypted offline identity copies and the live validator service | Initial copies confirmed; recurring current-state backup remains open | Name two custodians and implement/test current signing-state backup |
| Validator operator account | KaJ Labs | On-chain validator operator account and its signing authority | Custody must be confirmed through the approved secure channel | Test a non-destructive query/signing procedure; do not expose the key in chat or the repository |
| Validator signing state | KaJ Labs | `priv_validator_state.json`, paired with the active consensus key | Live state exists; recurring protected backup remains open | Preserve current height/round/step and enforce single-writer recovery |
| P2P and private validator mesh | KaJ Labs | `wg-mainnet` topology and node configuration | Running | Maintain WireGuard and P2P access without exposing validator APIs publicly |
| Public RPC, REST, gRPC, and WebSocket | KaJ Labs | TLS proxy and sentry node services | Live | Monitor availability, certificate renewal, rate limits, and consumer migration from raw ports |
| DNS, Cloudflare, and certificates | KaJ Labs | DNS/proxy configuration and Certbot renewal path | Client account access confirmation pending | Name administrators, alert on expiry, and test renewal/reload periodically |
| Monitoring and incident response | KaJ Labs | Runbook, health checks, and verification script | Mainnet-specific paging remains open | Assign on-call coverage and test the no-block alert and escalation path |
| Lithoscan explorer | KaJ Labs | Explorer code, production deployment, Cloudflare routing, restricted deployment identity, and rollback procedure | Live; cutover and monitoring closeout passed 2026-07-31 | Maintain monitoring, certificate/edge ownership, release controls, and tested rollback capability |
| Genesis and network identity | KaJ Labs | Checksum-pinned genesis, chain IDs, binary hash, and launch evidence | Delivered and immutable | Archive verified copies; do not regenerate or edit genesis |
| Native allocation and treasury wallets | KaJ Labs | Client-supplied allocation addresses | No private custody material is contained in the handoff repository | Confirm custody and decide whether eligible EVM treasury controls move to a tested Safe |
| Governance and economic decisions | KaJ Labs | Current genesis parameters and documented open decisions | Owner assigned; final policy record pending | Record governance owner, allocation labels, and fee/burn policy |
| LEP100 token administration | KaJ Labs or the applicable token issuer | No mainnet LEP100 registry or production token-admin key is represented as delivered | Outside completed base-chain handoff | Publish an approved registry and per-token owner/Safe policy before exchange listing |
| Bridge, MultX, Swap, and Faucet | KaJ Labs | No production admin control; these components are disabled | Outside initial mainnet scope | Complete separate deployment, audit, governance, and custody acceptance before activation |

## 3. Can KaJ Labs change the validator signing key after handoff?

**Yes, KaJ Labs can initiate and control a validator-key replacement after
handoff, but the active validator's consensus key must not be changed by simply
replacing `priv_validator_key.json`.** The consensus public key is part of the
on-chain validator identity. An uncoordinated file replacement will not rotate
that identity and can stop block production. Reusing the old key on two hosts
can cause double-signing and permanent validator penalties.

For this Cosmos SDK/CometBFT validator, treat consensus-key change as a
coordinated validator replacement:

1. KaJ Labs approves a maintenance plan, rollback conditions, and named key
   custodians.
2. Generate the new operator and consensus keys in the client-approved custody
   environment. Never generate or transmit them in chat or version control.
3. Back up and checksum the current `priv_validator_state.json`; prove that the
   existing validator remains the only process using the old consensus key.
4. Provision and fully synchronize a new validator host without starting it as
   an unauthorized replacement signer.
5. Create the new on-chain validator identity with transferred existing LITHO
   stake. The fixed supply means no new stake may be minted for the rotation.
6. Coordinate voting-power movement so the chain retains more than two-thirds
   active voting power throughout the transition. This is critical while the
   network has only one active validator.
7. Verify the new validator is bonded and signing, then retire/unbond the old
   validator under an approved sequence.
8. Observe block production and all public endpoints, archive the change
   record, and revoke or quarantine the old key according to the custody
   policy.

The exact transaction sequence, stake amounts, and timing must be rehearsed on
a matching non-production network and approved for the live validator set.
This is a chain-level maintenance operation, not a normal server key rotation.

## 4. Controls that can be rotated independently

| Control | Can KaJ Labs change it after handoff? | Important condition |
|---|---|---|
| Authorized SSH public keys | Yes | Test replacement access before removing the prior key |
| VPS-provider users and credentials | Yes | Keep two independent administrators and provider recovery access |
| DNS/Cloudflare administrators and API tokens | Yes | Preserve rollback and avoid changing chain endpoints without notice |
| TLS certificates | Yes | Certbot is staged; monitor expiry and validate Nginx reload |
| WireGuard keys | Yes | Rotate one peer at a time and preserve validator-to-sentry connectivity |
| CometBFT node identity key | Yes, with coordination | Peer identity changes; update persistent peers and address books as required |
| Validator consensus key | Not in place | Use the coordinated validator-replacement procedure in section 3 |
| Validator operator-account key | Not in place | An account key defines its address; move control through a planned validator replacement rather than overwriting it |
| Safe signers and threshold | Yes, for a deployed and tested Safe | Follow the Safe policy and verify the chain-9005 deployment before relying on it |
| Smart-contract owner/admin | Yes, when a contract supports transfer | Verify the exact deployed address and execute a two-step or timelocked transfer where available |
| Genesis, chain ID, or genesis allocations | No | These are immutable network identity; changing them creates a different chain |

## 5. Secure handover evidence

The client acceptance record should reference evidence, not secret values:

- KaJ Labs account administrators can access the repository, VPS provider,
  DNS/Cloudflare, and monitoring systems;
- two authorized operators can independently access the nodes;
- validator identity backups remain encrypted, separately stored, and
  recoverable;
- the current signing-state backup and restore drill have named custodians;
- Safe addresses, signer threshold, and signer identities are recorded in the
  client-controlled custody register when applicable;
- obsolete delivery-team access is revoked only after replacement access is
  tested; and
- no key, seed phrase, password, or recovery material is placed in the signed
  checklist, shared group, Google Doc, or repository.

## 6. Acceptance boundary

This document assigns KaJ Labs as the accountable organization. It does not
claim that every technical-control transfer is already complete. Rows marked
pending must be validated in the client-controlled acceptance checklist, and
the remaining Critical and High operational gates require closure or explicit
risk acceptance.

## 7. Technical references

- The deployed Evmos `v20.0.0` release uses Cosmos SDK `v0.50.9` and CometBFT
  `v0.38.12`: [Evmos v20.0.0 release](https://github.com/evmos/evmos/releases/tag/v20.0.0).
- In Cosmos SDK `v0.50.9`, `MsgEditValidator` changes validator description,
  commission rate, and minimum self-delegation; it does not accept a new
  consensus public key:
  [Cosmos SDK staking message reference](https://pkg.go.dev/github.com/cosmos/cosmos-sdk@v0.50.9/x/staking/types#MsgEditValidator).
- CometBFT describes the consensus key as the key used by a validator to sign
  consensus votes and emphasizes protected key handling:
  [CometBFT validator documentation](https://docs.cosmos.network/cometbft/latest/docs/core/Validators).

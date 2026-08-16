# Makalu faucet rotation and release runbook

**Scope:** Makalu testnet native LITHO and LEP100 faucet assets

**Owners:** Faucet deploy owner + VPS owner + token treasury/contract owners

**Status:** Blocked pending wallet rotation, protected deployment access, and approved funding amounts

This runbook is the safe handoff for rotating and releasing the Makalu faucet.
It does not authorize a wallet drain, transfer, deployment, or server change.

## Current verified state

Public probe: `https://makalu.litho.ai/api/faucet/info`

Verified on 2026-08-16:

- The live faucet still derives address
  `0x43593dC799d432CB6382ae20186Ba5356AC7D271`.
- Native LITHO is funded.
- All ten LEP100 assets are below their minimum ten-token claim.
- WLITHO, LITBTC, JOT, COLLE, and FGPT report zero.
- LAX, IMAGE, AGII, BLDR, and MUSA report five.
- The public response is still the pre-safeguard schema: per-asset `available`,
  `claimableAmounts`, `minimumClaimAmount`, and `shortfall` are absent.
- The secured faucet image exists at digest
  `sha256:34391877a9029461dfc261ce1ed0704b791d19f9065c0367a297952e49be12d8`,
  but it has not been deployed.

## Required approvals and inputs

Before any mutation, record all of the following in the approved change record:

- Explicit authorization to drain the old faucet address into the new faucet
  address. Approval must name both public addresses.
- Approved native LITHO funding amount and operational reserve threshold.
- Approved funding amount and reserve threshold for every supported LEP100
  asset: WLITHO, LITBTC, LAX, JOT, COLLE, IMAGE, AGII, BLDR, FGPT, and MUSA.
- Named treasury operator, faucet deploy operator, VPS owner, rollback owner,
  and observation window.
- Authorized access to the faucet deployment environment and secret manager.
- Installed and validated restricted deploy, rollback, and status wrappers.

Do not infer amounts from earlier examples or current balances.

## Secret-handling boundary

- Generate the replacement wallet directly through the approved secret manager
  or an approved offline ceremony.
- Never put a private key in chat, an issue, a pull request, a workflow input,
  an artifact, a shell transcript, or a repository file.
- Share only the new public address for approval and funding records.
- Store the private key only under the faucet deployment environment's
  protected secret path.
- Do not reuse validator, explorer, indexer, bridge, or operator keys.
- Revoke the old faucet key only after the approved drain and post-deployment
  verification are complete.

## Protected VPS boundary

The deployment identity must be restricted to root-owned, source-reviewed
wrappers. The wrappers may expose only these literal operations:

- `status`: read faucet container/image/health state.
- `deploy`: pull the approved immutable faucet image and recreate only the
  faucet service while preserving protected environment data.
- `rollback`: restore only the previously recorded faucet image.

The deployment key must not provide an interactive shell, generic Docker or
Compose access, arbitrary `sudo`, port forwarding, or file-write access outside
the dedicated faucet deployment boundary. The VPS owner must provide wrapper
and policy SHA-256 values plus validation evidence before workflow activation.

## Rotation and funding sequence

1. Treasury and deploy owners approve the public old/new addresses, exact asset
   amounts, reserves, operator, window, and rollback owner.
2. The authorized operator generates the replacement key in the approved secret
   manager and records only its public address.
3. The VPS owner installs and validates the restricted wrappers and deployment
   key; unrestricted access remains denied.
4. The authorized treasury operator transfers the approved native LITHO and
   each LEP100 amount to the new address. If an old-wallet drain is approved,
   execute it exactly as approved and retain every transaction hash.
5. Verify the new address and every on-chain balance independently before any
   deployment.
6. Configure the protected faucet secret and confirmed Makalu RPC/chain values
   through the deployment environment, without printing their values.
7. Run the separate manual faucet release workflow against the immutable image
   digest. The workflow must call only the restricted wrapper.
8. Run the smoke and observation gates below. Roll back on any failed gate.
9. After the observation window passes, revoke the old key and close the change
   record with transaction, deployment, and monitoring evidence.

## Required release workflow gates

The manual faucet workflow must remain absent or disabled until the approval,
secret, wrapper, and funding gates above are complete. Before it can deploy, it
must:

- Require an approval-protected Makalu faucet environment.
- Accept or resolve an immutable image digest, never a mutable deployment tag.
- Verify the image signature, provenance, SBOM, and zero-CRITICAL vulnerability
  gate before contacting the VPS.
- Record the current image for rollback.
- Call only the restricted `status`, `deploy`, and `rollback` operations.
- Verify the public schema and new public faucet address.
- Roll back automatically if deployment or public health validation fails.

## Post-deployment smoke tests

All checks must use the public Makalu endpoint and the approved new address:

- `/api/faucet/info` returns HTTP 200 and the new `faucetAddress`.
- The response contains `ready`, `unavailableAssetIds`, and per-asset
  `available`, `claimableAmounts`, `minimumClaimAmount`, and `shortfall`.
- Every funded asset reports at least one approved claimable amount.
- An underfunded or unreadable asset fails closed without mutating cooldown.
- One approved live claim per asset succeeds and its transaction is verified.
- Post-claim balances match the expected debit.
- Cooldown and invalid-address rejection work.
- Low-balance alert delivery and acknowledgement are proven before reserves
  fall below one minimum claim.

## Rollback conditions

Roll back only the faucet image if any of these occurs during the observation
window:

- Public health or schema validation fails.
- The running address differs from the approved new public address.
- A funded asset is incorrectly reported unavailable, or an underfunded asset
  is reported available.
- Claim accounting, cooldown behavior, or transaction verification fails.
- Error rate, restart count, or alerting crosses the approved threshold.

Rollback does not reverse treasury transfers or restore an old private key.
Those require a separate explicit treasury/security decision.

## Closure evidence

MX-02 can close only when the record contains:

- Approval for both public addresses and all funding amounts.
- Restricted-wrapper checksums and installation validation.
- Immutable image digest and successful manual workflow run.
- Funding/drain transaction hashes and verified balances.
- One verified claim transaction per supported asset.
- Alert delivery/acknowledgement evidence.
- Named deploy, treasury, replenishment, monitoring, and rollback owners.

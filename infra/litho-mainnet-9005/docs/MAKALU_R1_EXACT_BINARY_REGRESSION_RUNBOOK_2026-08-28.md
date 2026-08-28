# Makalu exact-binary L1 regression runbook

Status: prepared; execution requires KaJ Labs change approval

Approved candidate SHA-256:
`1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc`

Scope: Makalu only. Never execute exploit-regression transactions on Kamet or
LITHO mainnet.

## Required owners and inputs

- KaJ Labs approval reference and exact UTC window;
- named execution operator and independent observer;
- authorized, test-funded Makalu transaction signer;
- approved Makalu RPC endpoints verified at the start of the window;
- current validator binary and data snapshots plus tested rollback path;
- reviewed regression-harness bytecode and its SHA-256/Keccak-256 identity.

No validator, account or recovery private key enters the repository, evidence
archive, shell transcript or chat.

## Preflight and canary

1. Confirm Makalu EVM chain ID `700777` and independently record the Cosmos
   chain ID returned by the node. Do not infer it from documentation.
2. Record the current height, block hash/time, peer count, catching-up state,
   validator voting status and recent block progression.
3. Record the installed binary SHA-256 on every node. Change only one approved
   canary validator; sufficient remaining voting power must stay online.
4. Stop the canary, install the exact candidate, re-hash it in place, start it,
   and wait for full synchronization and stable signing. A hash mismatch stops
   the window.
5. Record pre-test bonded-pool balance, target delegation, total native supply,
   harness balance and the ordinary-control accounts' balances using raw RPC
   responses and their block heights.

## Signed regression transactions

Deploy or use only the reviewed harness whose bytecode identity was approved
for this window. Submit and record four attempts matching the in-process suite:

1. internal module-account transfer before the staking-precompile call;
2. internal module-account transfer after the precompile call;
3. internal transfers both before and after the precompile call;
4. transfer after the precompile call with matching `msg.value`.

Each exploit attempt must reject/revert. After each receipt, re-query at a
finalized height and prove that the bonded-pool balance, target delegation,
harness balance and total native supply are unchanged. Use approved test gas
conditions that do not alter supply. If fee accounting changes supply, stop and
obtain Autha's written evidence treatment before continuing.

Submit one ordinary EOA control transaction and prove it succeeds normally.
Do not interpret API status alone: preserve signed transaction hashes, receipts
and independent state queries.

## Consensus and rollback gates

After the transactions, demonstrate advancing blocks, the canary fully caught
up, expected validator signing, stable peer count and no new consensus errors.
Rollback immediately on a binary mismatch, unexpected successful exploit path,
state invariant change, consensus degradation or unexplained supply change.
Preserve evidence before rollback; never restart from stale signing state.

## Evidence required for Autha

- approval reference, UTC window and named operator/observer;
- binary hash before installation and in-place after installation;
- endpoint/chain identity and pre/post consensus status;
- harness source/bytecode identity;
- all five signed transaction hashes, heights, receipts and finality evidence;
- height-bound before/after balances, delegation and total-supply responses;
- rollback readiness/result and post-test validator health;
- SHA-256 manifest covering every raw evidence file.

The observer must verify the evidence independently. Do not mark R1-M03 closed
until Autha accepts the resulting focused evidence package.

# MultX mainnet deployment gates

Status: **blocked - do not deploy or enable**

The immutable engineering candidate is
`multx-audit-candidate-v0.5.0-20260809`. It is not an audited production
release. Bridge, Swap, Cross-swap/MultX, and Faucet remain disabled on LITHO
mainnet.

## Completed preparation

- Destination chain ID and exact release-bridge address are included in every
  validator signature domain, with replay regression tests.
- OpenZeppelin ECDSA recovery rejects non-canonical high-s signatures, with
  explicit malleability regression tests on both bridge implementations.
- Contract, API, signer, SDK, and web source gates pass.
- Candidate bytecode hashes and coverage evidence are recorded under
  `docs/audit/`.
- The approved production candidate uses seven isolated AWS Fargate services,
  seven non-exportable `ECC_SECG_P256K1` KMS keys, seven DynamoDB
  anti-equivocation tables and unique private HTTPS/bearer-token boundaries.
- Transaction-free KMS identity verification is implemented while release
  signing remains fail-closed with `SIGNER_RELEASE_SIGNING_ENABLED=false`.
- Native ECS task credentials are used; no permanent AWS access keys, Roles
  Anywhere certificates or exportable signer private keys are required.
- Production API startup now requires an explicit audited network manifest and
  rejects all historical test-chain defaults.

## Blocking approvals and inputs

1. Independent contract and signer-protocol audit completed.
2. All Critical/High findings remediated and re-reviewed; every Medium finding
   fixed or explicitly accepted by the accountable owner.
3. Final immutable release tag approved after remediation.
4. Approved Safe, timelock, pause guardian, deployment, and fee-payer
   addresses for LITHO, Ethereum, BNB, and Base.
5. Approved bridge/token routes, daily caps, and supported assets.
6. Seven approved bridge signer assignments, with an approved 5-of-7
   threshold, unique KMS identities, route policies, recovery exercises, and
   acceptance records. These bridge signers are separate from the target 33+
   LITHO consensus validators.
7. Approved HTTPS/WSS RPC endpoints for every chain and funded deployment/gas
   accounts held through the approved custody process.
8. Explicit production-canary and final activation approvals.

No private key, mnemonic, TLS private key, database password, or deployment
credential belongs in this repository or chat.

## Controlled deployment sequence

1. Rebuild the final audited tag and compare bytecode with the approved hash
   record.
2. Deploy governance first. Confirm Safe membership, timelock delay, proposer,
   executor, and separate pause guardian through independent review.
3. Deploy bridges initially paused, deploy only approved wrapped assets, wire
   roles, and verify source plus constructor-linked runtime bytecode on every
   explorer.
4. Commit an immutable, sanitized contract-address manifest containing chain
   IDs, transaction hashes, block numbers, bytecode hashes, constructor values,
   owners, guardians, caps, and token routes.
5. Complete `infra/network.mainnet.template.json`, validate it through the API
   loader, mount it read-only, and deploy immutable API/signer image digests to
   the isolated Fargate services. Keep release signing and public feature flags
   disabled.
6. Prove private-network rejection, bearer-token rejection, independent
   source-event verification, route-policy rejection, DynamoDB
   anti-equivocation persistence, KMS identity recovery, API database
   recovery, monitoring, and pause/rollback procedures.
7. Run the approved canary with bounded value and limits, reconcile source and
   destination state, then pause again for review.
8. Enable MultX only after written activation approval and a final public smoke
   test. Swap and Faucet require their own approval and remain fail-closed.

Any mismatch in chain ID, address, bytecode, signer quorum, governance owner,
route, cap, or audit record stops the rollout. The rollback action is to keep or
return bridges to paused state, stop relaying/signing, preserve evidence, and
restore the last approved API/UI release.

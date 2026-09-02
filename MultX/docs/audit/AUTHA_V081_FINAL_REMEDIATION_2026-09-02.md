# Autha v0.8.1 final-remediation closure candidate

Status: engineering remediation complete; focused Autha closure review required.

This change set addresses H-01, H-02, H-03 and M-01 from Autha's MultX
v0.8.1 Final-Remediation Security Review. It does not authorize deployment,
funding, unpausing, signing, release execution or public activation.

## H-01: approved deployment root

- The read-only verifier requires the exact approved plan bytes, deployment
  manifest and independent bytecode-evidence JSON as three separate inputs.
- It recomputes and compares both file digests.
- It validates the plan and manifest independently.
- It binds release tag/commit, audited bytecode, precomputed bridge and token
  addresses, ordered 5-of-7 signers, Safe, timelock, guardian, origin mappings,
  caps and routes from the approved plan through the manifest to live state.
- It checks the live timelock delay and the Safe's proposer/executor roles.
- Wrapped-token runtime verification zeroes only compiler-declared immutable
  slots before comparison with the independently generated audited hash.

## H-02: creation provenance

- Each bridge and wrapped token requires a successful deployment receipt whose
  contract address and block match the approved record.
- The transaction hash, approved deployer and audited creation-bytecode prefix
  are verified.
- Code must be absent at `creationBlock - 1` and present at `creationBlock`.
- Lock, release and route histories begin only at that proven creation block.

## H-03: bounded metrics

- Raw request paths are never used as Prometheus labels.
- Dynamic endpoints map to fixed templates; all unknown paths map to
  `/unmatched`; unknown methods map to `OTHER`.
- A 10,000-unique-path regression test proves constant route cardinality.
- Production requires an explicit bounded trusted-proxy hop count before the
  API can start, preserving rate-limit client identity behind the proxy.

## M-01: exact coordinator topology

- Production requires `SIGNATURES_REQUIRED=5`.
- Signer URL/address slots must be exactly contiguous indices 0 through 6,
  with seven unique addresses and no additional loaded slots.
- Before starting the signing loop, every production bridge must report the
  configured chain ID, threshold 5, validator count 7 and exact ordered signer
  set.
- The destination topology is re-read immediately before persisting a transfer
  as `signed`, so a post-startup rotation fails closed.

## Verification

- API: 37 tests pass.
- Contracts and deployment verification: 118 tests pass.
- MultX remains disabled pending Autha closure, immutable release evidence and
  approved chain-specific finality parameters.

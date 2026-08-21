# Autha v0.8.0 Remediation Record

Date: 2026-08-22

Status: engineering remediation candidate; independent Autha fix review pending.

Activation: forbidden. MultX must remain disabled until the reviewed source is
merged, tagged immutably, rebuilt from a clean checkout, and Autha binds its
final fix-review disposition to that exact tag and 40-character commit.

## Finding closure map

### H-01: pristine deployment history

The transaction-free mainnet verifier now pins every read to one verification
block and fails unless:

- the bridge nonce is zero;
- no `TokensLocked` or `TokensReleased` event exists from the deployment block
  through the pinned verification block;
- every asset has zero lock and release volume; and
- every wrapped asset has zero total supply.

The verifier emits the exact verification block number and hash for retained
deployment evidence. Log queries are bounded to avoid relying on unbounded RPC
ranges.

### M-01: exact route universe

The verifier checks each declared route and reconstructs every route ever
configured from `SupportedRouteSet` history. Any route that is currently enabled
but absent from the approved asset route list fails verification, including an
arbitrary chain ID outside the four production networks.

### M-02: immutable source-bridge provenance

Migration `008-source-bridge-provenance.sql` adds a non-null, validated
`source_bridge` column. The event listener stores the bridge that emitted each
lock. Validator signing, release submission, mock signing, and public status
responses use the stored value rather than reconstructing it from mutable
runtime configuration.

Existing history is backfilled only when a source chain has exactly one durable
bridge cursor. Ambiguous rows stop the migration and require manual
reconciliation.

### M-03: validator rotation safety

The release executor caches only its signer-bound RPC connection. It reloads
`signaturesRequired()` and `getValidators()` from the destination bridge before
every release attempt, so membership and quorum changes do not depend on a
process restart.

## Regression evidence

New tests cover:

- non-zero deployment nonce rejection;
- historical lock/release activity rejection;
- bounded deployment-history queries;
- arbitrary undeclared route rejection;
- persisted source-bridge ingestion; and
- live validator-policy refresh after rotation.

Final clean-checkout test counts, static-analysis output, source manifests, and
creation/runtime bytecode hashes must be generated only after merge and the
immutable review tag is created.

## Outstanding external gates

1. Autha reviews and accepts the remediations above.
2. Production finality depths are approved for LITHO, Ethereum, BNB Chain, and
   Base.
3. The exact reviewed commit is tagged and all final evidence is regenerated.
4. Deployment, governance handoff, bounded canary, and activation receive their
   separate approvals.

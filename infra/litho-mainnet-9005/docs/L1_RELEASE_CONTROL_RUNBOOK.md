# LITHO L1 release-control gate

This control applies to every L1 binary activation on Makalu, Kamet, and
mainnet. It does not itself deploy, restart, or submit a transaction.

## Mandatory sequence

1. Freeze the source and publish the exact binary as an immutable GitHub
   release asset.
2. Obtain Autha's written approval for that release identity and target.
3. Obtain KaJ Labs' written approval for the exact target, validator, UTC
   window, operator, observer, rollback plan, and any consensus pause.
4. Hash both approval artifacts and populate a copy of
   `L1_RELEASE_APPROVAL_TEMPLATE.json` under the protected approvals path.
5. Run `LITHO L1 release approval gate` against the tag, binary asset, approval
   JSON, and target environment.
6. Require a reviewer other than the execution operator on the corresponding
   `l1-<environment>-activation` GitHub environment.
7. Retain the successful workflow URL and gate artifact. A failed, skipped, or
   absent gate prohibits activation.
8. Immediately before mutation, run the same verifier on the target host
   against the exact staged binary and approval bundle.
9. Collect raw before/after evidence and obtain the observer attestation.

## Required environment protections

Create three independent environments:

- `l1-makalu-activation`
- `l1-kamet-activation`
- `l1-mainnet-activation`

Each environment must require approved reviewers and prevent self-review. Do
not store validator keys or approval-document contents as environment secrets.

## Direct verifier

```bash
python infra/litho-mainnet-9005/scripts/verify_l1_release_approval.py \
  --approval /secure/path/release-approval.json \
  --binary /secure/staging/lithod \
  --environment makalu
```

The verifier denies activation when the binary hash differs, an approval
artifact is absent or modified, an approval postdates the window, the window
is not currently active, the target differs, the observer is the operator, or
a required single-validator pause lacks explicit approval.

Root-level emergency bypasses must be treated as incidents and documented as
release-control exceptions. They are never normal deployment paths.

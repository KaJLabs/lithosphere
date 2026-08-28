# Autha Phase 0 R9 Focused Design-Freeze Handoff

Autha's R8 review closed all three R7 Critical and all six High findings. Please
review R9 only against the residual dispatcher-verification gap and the
wall-clock observation in the R8 report.

R9 adds:

- an independently authored JavaScript implementation and self-test of the
  complete immutable 20-row authorization dispatcher; and
- an explicit approximately 14h35m Makalu interpretation of the immutable
  100,000-block pending horizon, while keeping consensus strictly height based.

From the remediation directory, run the complete suite in `vectors/README.md`.
The focused dispatcher commands are:

```bash
python reference/authorization_dispatch_v1.py
node reference/authorization_dispatch_v1_independent.mjs
```

Verify the archive with:

```bash
python reference/verify_r9_package.py LITHO_PQ_PHASE0_REMEDIATION_R9_2026-08-28.zip
```

Requested decision: confirm the residual dispatcher gap and wall-clock
observation are closed and record Phase 0 design-freeze approval. Dependency,
implementation, KAT, performance and activation gates remain explicitly open.
This package requests no Makalu activation or mainnet approval and remains
unsigned pending Autha's freeze decision.

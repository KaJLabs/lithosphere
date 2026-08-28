# Autha Phase 0 R8 Design Re-Review Handoff

Please review R8 against the three Critical, six High and three Medium findings
in the R7 report. `NORMATIVE_PRECEDENCE.md` makes
`R8_AUTHORIZATION_AND_STATE_INVARIANTS.md` the highest-precedence closure text;
`AUTHA_R8_REMEDIATION_MATRIX.md` maps every finding to exact evidence.

The package contains:

- complete subject/action binding for every signed authorization action;
- embedded and commitment-checked next-policy preimages;
- bounded activation and recovery-root cancellation semantics;
- explicit sequence initialization and deterministic history transitions;
- issuer-signed provenance ordering and predecessor state;
- registry-root-bound emergency migration to an ACTIVE successor only;
- strict local `PolicyV1` validation and one 32-byte validator identifier rule;
- independent Python and JavaScript runners with fail-closed negative vectors.

From the remediation directory, run the commands in `vectors/README.md`, then
verify the archive with:

```bash
python reference/verify_r8_package.py LITHO_PQ_PHASE0_REMEDIATION_R8_2026-08-28.zip
```

Requested decision: confirm whether R7 C01-C03, H01-H06 and M01-M02 are closed
at the design level. M03 and all implementation/release gates intentionally
remain open. This package requests no activation or mainnet approval.

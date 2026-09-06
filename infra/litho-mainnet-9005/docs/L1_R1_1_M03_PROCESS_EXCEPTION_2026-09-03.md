# LITHO L1 R1.1 M03 release-control exception

Date: 2026-09-03

Status: **KaJ Labs accepted the documented process exception and corrective
controls; no deployment authorization granted**

## Immutable identities

- Finding: `AUTHA-L1-R1-M03`
- Release: `litho-l1-v20.0.0-r1`
- Binary SHA-256:
  `1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc`
- Affected environment: Makalu only (`lithosphere_700777-2`, EVM `700777`)
- Activation recorded at: `2026-09-01T10:05:26Z`
- Autha focused re-audit SHA-256:
  `2ff7f173878b8b2b953ff0c0f7785a23d98da9d57eb99f83f69b42208a20fa78`

## Original finding and acceptance requirement

`AUTHA-L1-M03 — prior approval was not evidenced.` No release-specific
pre-deployment Autha approval record was supplied. The candidate could not be
activated until Autha accepted the exact release identity and KaJ Labs retained
the required deployment approval before activation. Future gates must retain
that durable approval record before any rollout.

## Exception statement

The candidate was activated on Makalu without retaining the complete durable
pre-activation approval evidence required by the R1 gate. The later successful
regression cannot retroactively prove that authorization existed before the
activation time. This record therefore does not claim prior authorization.

The technical regression was supportive but incomplete as closure evidence.
Cases 1, 3, and 4 show clean reverts and the ordinary control succeeded. Case 2
consumed its complete gas limit, so its status-0 receipt alone does not prove
that the guarded path rejected it. Autha's 2026-09-02 review treated that
technical ambiguity and the missing release-control evidence as independent
reasons to withhold closure.

## Scope and impact

- No transaction in this regression was submitted to Kamet or mainnet.
- This exception grants no authorization for another Makalu activation or for
  any Kamet/mainnet deployment.
- No private key, credential, or private infrastructure detail belongs in this
  record or its public evidence package.

## Root cause

The deployment path relied on manual coordination and did not enforce a
machine-verifiable approval bundle before service activation. The execution
record also summarized raw evidence rather than preserving the complete raw
responses in the focused archive.

## Corrective and preventive actions

1. `verify_l1_release_approval.py` now fails closed unless the candidate binary
   matches the approved hash, Autha and KaJ Labs approval artifacts exist and
   hash correctly, both approvals predate the UTC window, the operator and
   observer differ, and any single-validator pause is explicitly approved.
2. The approval format is fixed by `L1_RELEASE_APPROVAL_TEMPLATE.json`.
3. Every future activation must run the verifier immediately before the
   service mutation and retain its output in the release evidence.
4. Environment reviewers must prevent the execution operator from approving
   their own protected deployment.
5. Raw RPC responses, on-host binary proof, health/log output, snapshot proof,
   observer attestation, a complete `SHA256SUMS.txt`, and a detached
   organizational signature must be retained for future controlled tests.
6. A failed or missing gate result prohibits installation, restart, rollout,
   or transaction submission.

## KaJ Labs disposition

The accountable KaJ Labs approver must complete this section through a durable,
reviewed record. Do not backdate it.

- Decision: `accept process exception`
- Approver name and GitHub username: Litho Agent (`@lithoagent`), acting for
  KaJ Labs
- Approval timestamp (UTC): `2026-09-04T00:20:05Z`
- Approval reference: KaJ Labs project-channel confirmation, durably recorded
  by the reviewed pull request containing this disposition
- Corrective controls accepted: `YES`

The provider snapshot was confirmed during the controlled window, but expired
automatically on `2026-09-02` and cannot be restored or freshly exported. A
retained screenshot of the provider confirmation is included only in the
secure evidence supplement. This limitation is disclosed rather than
reconstructed or backdated.

After KaJ Labs accepts the exception and the evidence supplement is complete,
submit both to Autha for focused M03 closure. Only Autha can provide the final
finding disposition.

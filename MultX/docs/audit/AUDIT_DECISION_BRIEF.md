# MultX Bridge Audit — Decision Brief (for Litho leadership)

> **Superseded historical decision brief.** It predates Autha's v0.7.0 review
> and must not be represented as the current v0.8 audit or release package.

**Prepared by:** infra team · **Updated:** 2026-08-19 · **Decision owner:** Litho leadership
**One-line ask:** approve the budget + pick a firm so we can sign the NDA and kick off the MultX bridge audit.

---

## Why this is the critical path

The security audit is the next external blocker for MultX mainnet. Until it is
complete and findings are resolved, no MultX contract may hold real assets and
the production feature remains disabled. Audit completion is followed by the
governance, signer, deployment, and canary gates; it is not automatic launch
approval.

- MultX bridge — real-asset transfers between **LITHO 9005** and **Ethereum / BNB / Base mainnets**
- DNNS — mainnet deployment of the naming service (testnet-complete on 3 chains)
- Public mainnet launch (M7)

The engineering candidate and audit package are ready. Production addresses,
operator acceptance, and activation remain deliberately unset.

## What's being audited (small + cheap by design)

A deliberately tight, self-contained scope so the audit is fast and inexpensive:

- **3 Solidity files, 382 code lines (681 physical lines including NatSpec/comments)** — the bridge + wrapped-token contracts. No proxies, no external protocol composability.
- The package includes the threat model, triaged Slither evidence, 88-test
  Hardhat suite, Foundry invariants, bytecode hashes, the non-AWS VPS signer
  protocol and immutable contract candidate
  `multx-audit-candidate-v0.6.0-20260819`.

## Cost & timeline (ballpark — firms confirm exact)

| | Estimate |
|---|---|
| **Fixed fee** | **~$20k–$50k for the contract scope**; the firm must quote the signer-protocol review separately |
| **Duration** | ~1–2 weeks review + a remediation re-review round |
| **Lead time** | start within 2–4 weeks of go-ahead |

RFQ already prepared and addressed to three top-tier firms — **Trail of Bits, Spearbit (Cantina), Halborn** — pick based on the quotes they return.

## What we need from you

1. **Approve the contract-audit budget** in the ~$20–50k range and authorize a
   separately itemized signer-protocol quote.
2. **Pick a firm** (or authorize us to run the RFQ and bring back quotes for your sign-off).
3. Note: per the RFQ, the **vendor contract + payment are handled directly by the client**; infra team is the technical contact and will manage the engagement end-to-end.

## What's ready to send right now

- Forwardable RFQ: `docs/audit/AUDIT_RFQ.md`
- Technical package: `docs/audit/AUDIT_RFQ.md`, `MULTX_THREAT_MODEL.md`, `slither-pre.txt`
- Immutable source bundle and checksums:
  [`multx-audit-candidate-v0.6.0-20260819`](https://github.com/KaJLabs/Lithosphere/releases/tag/multx-audit-candidate-v0.6.0-20260819)

Once leadership approves the engagement, the firm can review the already
published immutable candidate. Any remediation produces a new immutable tag;
the existing tag is never moved.

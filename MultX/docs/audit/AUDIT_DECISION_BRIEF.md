# MultX Bridge Audit — Decision Brief (for Litho leadership)

**Prepared by:** infra team · **Updated:** 2026-08-09 · **Decision owner:** Litho leadership
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

- **3 Solidity files, 378 code lines (677 physical lines including NatSpec/comments)** — the bridge + wrapped-token contracts. No proxies, no external protocol composability.
- The package includes the threat model, triaged Slither evidence, 76-test Hardhat suite, Foundry invariants, bytecode hashes, VPS signer protocol, and immutable candidate `multx-audit-candidate-v0.5.0-20260809`.

## Cost & timeline (ballpark — firms confirm exact)

| | Estimate |
|---|---|
| **Fixed fee** | **~$20k–$50k** (small scope; was $50–150k before we narrowed it to 3 files) |
| **Duration** | ~1–2 weeks review + a remediation re-review round |
| **Lead time** | start within 2–4 weeks of go-ahead |

RFQ already prepared and addressed to three top-tier firms — **Trail of Bits, Spearbit (Cantina), Halborn** — pick based on the quotes they return.

## What we need from you

1. **Approve a budget** in the ~$20–50k range.
2. **Pick a firm** (or authorize us to run the RFQ and bring back quotes for your sign-off).
3. Note: per the RFQ, the **vendor contract + payment are handled directly by the client**; infra team is the technical contact and will manage the engagement end-to-end.

## What's ready to send right now

- Forwardable RFQ: `client-work/MultX-Bridge-Audit-RFQ.pdf`
- Technical package: `docs/audit/AUDIT_RFQ.md`, `MULTX_THREAT_MODEL.md`, `slither-pre.txt`

Once leadership approves the engagement, the firm can review the already
published immutable candidate. Any remediation produces a new immutable tag;
the existing tag is never moved.

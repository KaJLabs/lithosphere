# MultX Bridge Audit — Decision Brief (for Litho leadership)

**Prepared by:** infra team · **Date:** 2026-06-18 · **Decision owner:** Litho leadership
**One-line ask:** approve the budget + pick a firm so we can sign the NDA and kick off the MultX bridge audit.

---

## Why this is the critical path

The security audit is the **single blocker between everything we've built and mainnet.** Until it's done and findings are fixed, the following are all on hold:

- MultX bridge — real-asset transfers on **Ethereum / BNB / Base mainnet** (Kamet source + all dest contracts are built and tested on testnet, waiting on this)
- DNNS — mainnet deployment of the naming service (testnet-complete on 3 chains)
- Public mainnet launch (M7)

Everything *we* control is done. This is the gate.

## What's being audited (small + cheap by design)

A deliberately tight, self-contained scope so the audit is fast and inexpensive:

- **3 Solidity files, 533 lines total** — the bridge + wrapped-token contracts. No proxies, no external protocol composability.
- We've pre-delivered a full **threat model**, a triaged **Slither** report, the **test suite**, and a frozen commit — so the firm goes straight to manual review (less billable time).

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

Once you green-light, we sign the NDA, freeze the final commit, and the firm can start within the window above.

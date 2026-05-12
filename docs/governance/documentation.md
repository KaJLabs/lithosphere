# Documentation governance

> Last reviewed: 2026-05-12 · Owner: Dev Infra · Linked phase: P11

The meta-runbook. Lists every governance/runbook document with its
owner, review cadence, and last-reviewed marker convention.

The motivation is simple: docs drift. A runbook nobody reviews quietly
becomes wrong, and nobody notices until a fire is burning. This page
makes the review cadence explicit so docs get refreshed on schedule
rather than only after an incident exposes that they're stale.

---

## Doc registry

| Doc | Owner | Review cadence | Triggered review |
|-----|-------|----------------|------------------|
| [`raci.md`](raci.md) | Dev Infra | Quarterly | Role rotation, new team |
| [`release-process.md`](release-process.md) | Dev Infra | On release-please config change | Any change to `.github/release-please-config.json` |
| [`release-calendar.md`](release-calendar.md) | Dev Infra + Validator Team | Every release cycle | Cycle cut, postponement |
| [`cab.md`](cab.md) | Dev Infra + Validator Team | Quarterly | After every emergency CAB |
| [`deployment-approvals.md`](deployment-approvals.md) | Dev Infra | When CD workflow changes | `deploy-simple.yaml` / `deploy.yaml` edit |
| [`observability.md`](observability.md) | Dev Infra | Quarterly | New dashboard, new metric, new pipeline |
| [`audit-trail.md`](audit-trail.md) | Dev Infra | When `AuditAction` union changes | Adding/removing an audit action |
| [`supply-chain.md`](supply-chain.md) | Dev Infra | Quarterly | Cosign/SLSA tooling bump |
| [`artifact-catalog.md`](artifact-catalog.md) | Dev Infra | When a new artifact class lands | Multi-arch images, new package |
| [`contract-deployment.md`](contract-deployment.md) | Dev Infra + Validator Team | Annual | Multi-sig signer rotation, Ledger model change |
| [`key-rotation-runbook.md`](key-rotation-runbook.md) | Dev Infra + Security Lead | Semi-annual | Any key rotation event |
| [`license-policy.md`](license-policy.md) | Dev Infra | When `.license-policy.yaml` changes | Adding a denied or allowed license |
| [`test-quarantine.md`](test-quarantine.md) | Dev Infra | When `.test-quarantine.yaml` gains an entry | Quarantined test added |
| [`incident-response.md`](incident-response.md) | Dev Infra + Validator Team | After every Sev-1/2 PIR | PIR action item flags this doc |
| [`rfc-template.md`](rfc-template.md) | Dev Infra | Annual | RFC process retro |
| [`pir-template.md`](pir-template.md) | Dev Infra | Annual | PIR retro highlights template gaps |
| [`rfcs/0001-release-trains.md`](rfcs/0001-release-trains.md) | Dev Infra + Validator Team | Pending sign-off | Sign-off lands |
| [`documentation.md`](documentation.md) (this doc) | Dev Infra | Annual | New runbook added |

Adding a new runbook is a 3-step PR:

1. Write the runbook in `docs/governance/`
2. Add a row to the table above (this file)
3. Add a sidebar entry in `_sidebar.md`

---

## Last-reviewed marker convention

Every runbook starts with:

```markdown
# <Title>

> Last reviewed: YYYY-MM-DD · Owner: <role> · Linked phase: P<n>
```

The reviewer updates the date whenever they confirm the doc is still
accurate, regardless of whether they edit anything. "No changes needed"
is a legitimate review outcome and worth recording.

A doc whose Last-reviewed is older than its review cadence is **stale**.
We don't currently CI-check for this; the practical signal is the
quarterly governance pass below.

---

## Quarterly governance pass

Once per calendar quarter, Dev Infra (or whoever picks up the task)
walks the table above and:

1. For each doc whose review cadence has elapsed since the
   Last-reviewed date, open a PR that either:
   - Updates the doc content to match current reality, OR
   - Touches only the Last-reviewed line with a comment "audited, no
     changes needed"
2. For each PR that says "no changes needed," the reviewer (different
   person from author) sanity-checks that the doc really doesn't need
   updates. The bar is low — "spot-check one section" is enough.

The pass is meant to be cheap. A 30-minute timebox per quarter beats
a 4-hour rewrite session two years from now when nothing makes sense
anymore.

---

## Triggered reviews (in-line)

Some doc updates are NOT scheduled — they're triggered by code/config
changes elsewhere. The "Triggered review" column above lists them. The
discipline is: when you change the trigger artifact, you update the
linked doc in the same PR.

Examples:

- A PR that adds a new audit action to `Makalu/api/src/lib/audit.ts`
  must also add a row to the catalog in `audit-trail.md`.
- A PR that adds a new entry to `.test-quarantine.yaml` must also
  update the "currently empty" line in `test-quarantine.md` if it was
  previously empty.
- A PR that changes `.github/release-please-config.json` must update
  the conventional-commit-types table in `release-process.md`.

These aren't enforced by CI today (would need bespoke gates per doc).
Reviewer discipline catches them. The most common miss is updating
`raci.md` after a team role change.

---

## Doc style conventions

- Lead with **why this doc exists**, not what it covers. Reader knows
  they're on `incident-response.md`; what they need to know is the
  motivation for the structure that follows.
- **Concrete examples beat abstract description.** Every runbook
  should have at least one copy-paste-able command, query, or
  template.
- **Anti-checklists** (a list of "do NOT do" items) are valuable.
  Most runbooks have a section.
- **Cross-references** at the bottom, not inline, so the body reads
  cleanly. Link from "see [doc]" rather than reprinting content.
- **No emojis** unless explicitly requested. The codebase convention.
- **Plain markdown.** No mermaid, no JSX, no fancy embeds. Docsify
  renders the site; keep the source readable in any editor.

---

## Open follow-ups

- **CI lint for last-reviewed markers**: a script that scans
  `docs/governance/**/*.md` for the marker, compares to the review
  cadence here, and posts a list of stale docs as a CI step. Defer
  until enough docs are flagged that the quarterly pass becomes
  expensive.
- **Per-doc CODEOWNERS**: today CODEOWNERS is repo-wide. Per-doc
  ownership would make review requests auto-route to the right
  human; nice-to-have once we have more than one human per role.

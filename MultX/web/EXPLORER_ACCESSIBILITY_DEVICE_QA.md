# Kamet Explorer Accessibility and Device QA

Updated: 2026-04-20

Scope: manual accessibility review and real-device sign-off for the public `kamet-explorer` deployment. This complements the automated axe smoke checks and Playwright responsive regression suite.

## Goal

Use this checklist before calling the explorer production-ready. The automated suite already covers representative serious and critical accessibility issues plus responsive regressions, but it does not replace human review on real browsers and devices.

## Test Matrix

Run the checklist on at least this matrix:

| Surface | Minimum matrix |
| --- | --- |
| Desktop keyboard and screen review | Chrome latest on Windows, Safari or Chrome on macOS |
| Mobile touch review | iPhone Safari, Android Chrome |
| Tablet touch review | iPad Safari or Chrome on Android tablet |
| Wallet-connected review | One injected EVM wallet on the intended Kamet chain |

## Route Matrix

Verify the following routes directly from the browser address bar:

- `/`
- `/blocks`
- `/block/<known height>`
- `/transactions`
- `/tx/<known hash>`
- `/address/<known address>`
- `/token/<known token or native>`
- `/validator/<known operator>`
- `/contract/<known contract>`
- `/search?q=<known query>`
- `/network`
- `/not-a-real-route`

## Accessibility Review

### Keyboard

- Tab from the browser chrome into the page and confirm the skip link appears first.
- Activate the skip link and confirm focus lands on the main content region.
- Continue tabbing through header controls, search, CTA buttons, table rows, tabs, links, retry buttons, and footer links.
- Confirm focus indicators remain visible on dark surfaces.
- Confirm Enter and Space activate interactive table rows, tabs, and copy controls without double-triggering nested links or buttons.
- Confirm Esc is not required for any critical flow because the explorer does not depend on trapped modal navigation for core pages.

### Screen Reader and Semantics

- Confirm the main page heading is announced once per route.
- Confirm the global search input is announced with its label and live validation hints.
- Confirm address activity tabs and token filter tabs announce their active panel correctly.
- Confirm status badges, retry buttons, and copy buttons have meaningful accessible names.
- Confirm tables expose readable headers on blocks, transactions, address activity, token holders, validators, and monitored endpoints.

### Visual Accessibility

- Confirm text remains readable in dark mode with sufficient contrast for:
  - headings
  - body copy
  - muted helper text
  - tables
  - hover states
  - focus states
  - empty states
  - error states
- Confirm long hashes and addresses remain readable when zoomed to 200%.
- Confirm browser zoom at 200% does not make the sticky header unusable.

## Real-Device Review

### Mobile

- Confirm the sticky header does not overlap the hero or first table row while scrolling.
- Confirm the global search field remains usable with the on-screen keyboard open.
- Confirm no horizontal page scrolling appears on representative routes.
- Confirm touch targets are large enough for:
  - menu toggle
  - search button
  - wallet button
  - tabs
  - copy buttons
  - pagination buttons
- Confirm route changes remain smooth on:
  - home
  - blocks
  - tx detail
  - address
  - token
  - validator
  - network

### Tablet

- Confirm the header wraps cleanly without clipping the status badge or wallet button.
- Confirm tables remain usable when horizontally scrolled inside their own container.
- Confirm network status cards, address panels, and token panels preserve readable spacing in portrait and landscape.

## Wallet and Contract Review

- Connect an injected wallet on the intended Kamet chain.
- Confirm the wallet button changes state correctly in the header.
- Confirm add-network works when the wallet starts on a different chain.
- Confirm contract write UI remains locked until the wallet is connected on Kamet.
- Confirm disconnect does not immediately auto-reconnect after a user-triggered disconnect.

## Result Capture

Record the execution date, tester, device, browser, and outcome for each pass:

| Date | Tester | Device | Browser | Routes covered | Wallet tested | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | name | device | browser | routes | yes/no | pass/fail | notes |

## Related Docs

- `EXPLORER_RELEASE_CHECKLIST.md`
- `EXPLORER_PRODUCTION_HARDENING_CHECKLIST.md`
- `EXPLORER_IMPLEMENTATION_STATUS.md`

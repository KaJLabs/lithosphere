# MX-03 Thanos Wallet acceptance

Use this record to close the remaining wallet-team acceptance for the Makalu explorer. Do not mark MX-03 complete
until every manual result and the approval record are filled with durable evidence.

## Verified baseline

| Item | Verified value | Evidence |
| --- | --- | --- |
| Target | `https://makalu.litho.ai/signin` | Live route |
| Network | Makalu, EVM chain ID `700777` (`0xab169`) | Explorer network configuration |
| Published Chrome extension | `0.9.33`, updated 2026-08-12 | Chrome Web Store item `jajfgpnlaoakklhnnchdpiglmkkpcehj`, checked 2026-08-14 |
| Published-version source | `imasssad/Thanos-Wallet` commit `c352a5cfef22` | Declares `0.9.33`, EIP-6963, RDNS `fi.thanos.wallet`, `window.thanos`, and EIP-1193 signing |
| Explorer integration | EIP-6963 discovery plus verified `window.thanos` fallback | `Makalu/explorer/components/ThanosSignIn.tsx` |
| Server authentication | Nonce-bound SIWE, one-time replay protection, HMAC bearer session | `Makalu/api/src/routes.ts` and focused tests |
| Makalu session secret | Present, non-placeholder, and at least 32 characters | Value-free production-container check on 2026-08-14 |

The repository source currently declares Thanos `0.9.35`, but that was not the published Chrome version at the time
of this check. Run acceptance with published version `0.9.33` unless the Chrome Web Store version is re-verified and
this baseline is updated first.

## Wallet-team test record

Record a screenshot, transaction URL, test-run URL, or other durable reference in the Evidence column. Never attach
seed phrases, private keys, session tokens, or deployment secrets.

| Scenario | Expected result | Result | Evidence |
| --- | --- | --- | --- |
| Fresh extension install | Thanos is detected; no other injected wallet is selected | PENDING | |
| Late provider announcement | Thanos becomes available without a page reload | PENDING | |
| Connection rejection | Explorer shows an actionable rejection and creates no session | PENDING | |
| Signature rejection | Explorer shows cancellation and creates no session | PENDING | |
| Wrong active chain | Explorer requests a switch to Makalu | PENDING | |
| Makalu missing | Explorer requests adding Makalu, then switches successfully | PENDING | |
| SIWE sign-in | Correct address is shown and `/api/auth/me` validates the session | PENDING | |
| Nonce replay | Reusing the signed message is rejected | PENDING | |
| Reconnect | The same authorized wallet reconnects correctly | PENDING | |
| Sign out | Server-backed local session and explorer wallet state are cleared | PENDING | |
| Extension restart | Valid session restores and is server-validated | PENDING | |
| Browser restart | Valid session restores and is server-validated | PENDING | |
| API restart | Existing session remains valid after the API restarts | PENDING | |
| Low-value transaction | Thanos signs on chain `700777`; transaction succeeds and appears in Makalu Lithoscan | PENDING | |

## Required transaction evidence

- Transaction hash: `PENDING`
- Lithoscan URL: `PENDING`
- Sender public address: `PENDING`
- Asset and approved amount: `PENDING`
- Confirmed chain ID: `PENDING`
- Confirmation timestamp (UTC): `PENDING`

## Approval record

- Wallet-team approver: `PENDING`
- Approver role or GitHub username: `PENDING`
- Tested Chrome/Chromium version: `PENDING`
- Tested Thanos version: `PENDING`
- Test date (UTC): `PENDING`
- Acceptance evidence URL: `PENDING`
- Decision: `PENDING`

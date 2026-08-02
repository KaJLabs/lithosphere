# LITHO Mainnet Exchange Documentation Release Checklist

Last reviewed: 2026-07-31

Purpose: prevent a technically useful draft from being shared as a final
listing package before client-owned production facts are ready.

## 1. Current disposition

| Area | Status | External wording |
|---|---|---|
| Base chain | Live and reverified | May be stated as live |
| EVM/Cosmos node APIs | Live | May be supplied with rate-limit/private-node caveat |
| Explorer | Live and cutover-accepted | May provide `https://lithoscan.ai` with the exchange's independent-indexing requirement |
| Public source release | Access/publication pending | Current repository may require access |
| Signed binary download | URL pending | Supply checksum only with controlled artifact |
| Public block-data snapshot | Not available | State clearly; sync from genesis |
| Mainnet LEP100 registry | Not published | Do not list testnet contracts |
| Official wallet on chain 9005 | Compatibility confirmation pending | MetaMask manual config only; qualify Thanos |
| Mainnet bridge | Disabled | No wrapped assets; no completed audit report |
| Confirmation policy | Provisional recommendation only | Requires client/exchange approval |
| Exchange transfer opening | Business date/time pending | Do not equate technical availability with listing opening |

## 2. Explorer gate — client explorer team / Adnan Dev 2

- [x] `https://lithoscan.ai` returns the production mainnet UI without redirect,
  challenge, or HTTP 403/5xx for normal unauthenticated users.
- [x] Explorer identifies Cosmos chain `lithosphere_9005-1` and EVM chain `9005`.
- [ ] Latest height and block time match two independent node endpoints.
- [ ] Height 1 matches hash
  `7418C1962B64597EE91D6747ECE3D5325C8B17B261E4C0E4A109A9BAFE74F509`.
- [ ] Search works for block height/hash, transaction hash, `0x` address, and
  `litho1` address.
- [ ] Native balances display 18 decimals without floating-point loss.
- [ ] Successful and failed EVM receipts are distinguishable.
- [ ] LEP100 pages identify assets by contract address and decode `Transfer`
  logs correctly.
- [ ] Explorer/API does not display testnet LEP100 addresses as mainnet assets.
- [x] TLS and the restricted rollback procedure passed cutover validation;
  cache, rate-limit, and error-page policy remain routine operational checks.
- [x] Public smoke-test evidence and explicit cutover approval are archived in
  the cutover record and `lithoscan-window-close.json`.

## 3. Release-artifact gate — infrastructure/release owner

- [ ] Audit public Lithosphere resource/docs pages and remove any stale
  designation of chain IDs `700777` or `900523` as mainnet; the only exchange
  mainnet identity in this package is `lithosphere_9005-1` / EVM `9005`.
- [ ] Publish a public or exchange-accessible immutable source tag/commit.
- [ ] Publish the Linux x86_64 mainnet binary at a stable HTTPS release URL.
- [ ] Publish SHA-256
  `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`.
- [ ] Publish artifact signature and signer-verification instructions.
- [ ] Include fixed-supply patch, build script, dependency/SBOM artifacts, and
  focused-test results in the release.
- [ ] Confirm the public genesis URL body and response header match SHA-256
  `13e4875b4a9dddc63bdfbd4968c7265f9bbc49218b59c5b49231a56fa313046f`.

## 4. Snapshot decision — node operations owner

Select and document one:

- [ ] No public snapshot at listing; exchange syncs from genesis and peers.
- [ ] Publish a snapshot with chain ID, height, block hash, creation time,
  format/compression, size, SHA-256, binary compatibility, and restore test.

Never publish a private validator data directory, consensus key, signing state,
or testnet snapshot.

## 5. Asset and LEP100 gate — protocol/token owner

- [ ] Publish the signed machine-readable mainnet LEP100 registry.
- [ ] For every asset, include chain ID, contract, deployment transaction,
  name, symbol, decimals, total supply, source release, and runtime-code hash.
- [ ] Complete reproducible bytecode verification for every listed contract.
- [ ] Record issuer and ownership/control addresses.
- [ ] Confirm no testnet contract is included.
- [ ] State whether each contract is the unmodified LEP100 reference or a
  separately audited modification.
- [ ] Provide token-specific audit reports required by the exchange.

## 6. Wallet gate — wallet/product owner

- [ ] Confirm Thanos Wallet supports EVM chain `9005`, the production RPC, and
  the approved explorer URL.
- [ ] Test new wallet, restore, native send/receive, LEP100 send/receive, fee
  display, wrong-network rejection, and transaction-history links.
- [ ] Publish direct official web/mobile/extension links and version numbers.
- [ ] Confirm whether MetaMask is an officially supported fallback or only a
  compatible third-party wallet.

## 7. Exchange policy gate — accountable client and exchange

- [ ] Approve normal native deposit confirmations.
- [ ] Approve high-value native deposit confirmations.
- [ ] Approve LEP100 deposit confirmations.
- [ ] Approve minimum deposits and withdrawals, fees, and dust policy.
- [ ] Approve one-validator operational risk or close the validator-set gate.
- [ ] Approve deposit/withdrawal pause triggers.
- [ ] Approve final mainnet transfer-opening date and UTC timestamp.
- [ ] Approve the MEXC/community warning text.

Suggested provisional values in the draft are 20 blocks normally and 100
blocks for high value. They are not official until signed here.

## 8. Bridge statement

Select one:

- [ ] Listing is native mainnet LITHO/LEP100 only; bridge and wrapped assets are
  explicitly out of scope and disabled.
- [ ] A separate bridge integration is requested; provide deployed addresses,
  routes, operational controls, and the completed independent audit before
  enabling it.

An audit RFQ or internal test report is not a completed bridge audit.

## 9. Final validation

- [ ] Run every API example against the production endpoint and an exchange
  node; retain sanitized output.
- [ ] Run native deposit and withdrawal end to end.
- [ ] Run at least one approved LEP100 deposit, sweep, and withdrawal end to end.
- [ ] Test failed/reverted transactions and confirm no credit.
- [ ] Test duplicate replay and confirm exactly-once credit.
- [ ] Test node restart, indexer replay, RPC outage, peer loss, and alerting.
- [ ] Confirm no secrets, private keys, credentials, or private contact details
  are present in the external package.
- [ ] Legal/compliance and accountable technical owners approve release.

## 10. Google Docs publication

After all required gates are complete:

1. Regenerate the combined PDF and DOCX from the reviewed Markdown source.
2. Create a restricted Google Doc titled
   `LITHO Mainnet Exchange Integration — v1.0 — YYYY-MM-DD`.
3. Import the DOCX, verify tables/code formatting and every link, and make the
   first line state the approved version and UTC review date.
4. Give edit access only to named client owners; give the exchange review team
   view/comment access as agreed.
5. Attach or link immutable checksums for genesis, binary, PDF, and source tag.
6. Record the Google Doc URL and access owner below.

| Field | Value |
|---|---|
| Google Doc URL | `TBD` |
| Document owner | `TBD` |
| Final version/date | `TBD` |
| Client approver | `TBD` |
| Exchange recipient | `TBD` |

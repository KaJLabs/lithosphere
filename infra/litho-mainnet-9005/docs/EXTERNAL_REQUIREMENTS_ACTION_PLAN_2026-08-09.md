# LITHO remaining external requirements action plan

**Date:** 2026-08-09  
**Scope:** LITHO mainnet operational acceptance, expansion to 33+ consensus
validators, and the separately gated MultX mainnet launch.  
**Repository state:** PR #73 remains open and unmerged. Bridge, Swap, Faucet,
and MultX remain disabled.

No private key, mnemonic, recovery key, password, API token, TLS private key,
or database credential may be sent through chat or committed to Git. Protected
values must be entered directly into the named secret manager by an authorized
administrator.

## Responsibility summary

| # | Requirement | Primary external owner | Our responsibility | Completion evidence |
|---:|---|---|---|---|
| 1 | MultX contract and signer-protocol audit | Client leadership and independent audit firm | Deliver package, answer questions, remediate findings, publish a new final candidate | Final report and remediation letter |
| 2 | Fixed-supply patch review | Client and independent Cosmos/Evmos reviewer | Supply pinned patch/binary evidence and remediate findings | Dated review tied to exact hashes |
| 3 | 32 additional consensus validators | Client ecosystem lead and 32 independent operators | Validate public intake and onboard in controlled waves | 33+ unique bonded validators after observation |
| 4 | Mainnet monitoring activation | Client on-call owner and GitHub administrator | Install/test progression checks and Prometheus rules | Successful monitor plus tested page route |
| 5 | Current signing-state backup activation | Two client recovery custodians and GitHub administrator | Install restricted exporter and run encrypted backup/verification | Scheduled ciphertext backup and isolated drill |
| 6 | MultX governance and custody decisions | Client security/custody owners | Encode approved public addresses and verify ownership | Approved Safe/timelock/guardian manifest |
| 7 | Seven independent MultX bridge signers | Client security lead and signer operators | Deploy rootless mTLS signer services and test policies | Seven accepted signers and approved threshold |
| 8 | MultX routes, limits, endpoints and gas funding | Client product, custody and infrastructure owners | Validate fail-closed manifest and run paused canary | Approved route manifest and canary record |
| 9 | Chain-ID registration evidence | Client/registry submitter | Archive public evidence in the handoff | Registry link, PR, ticket or acceptance record |
| 10 | Economic and governance ownership record | Client leadership/economics owner | Record decisions without changing sealed genesis | Wallet labels and approved policy record |
| 11 | Recovery, failover and raw-port closure | Client maintenance approver and integration owners | Run controlled drills and restrict ports | Drill evidence and port scan |
| 12 | Lithoscan synchronization closeout | Explorer/indexer team | Monitor chain identity, advancement, lag and consistency | Lag within approved threshold and smoke pass |

## 1. MultX independent security audit

**Who can complete it:** Client leadership authorizes the spend and contract;
Trail of Bits, Spearbit/Cantina, Halborn, or another approved independent firm
performs the review. Our team manages the technical engagement.

**Required:**

- approve an approximately USD 20,000-50,000 budget or authorize an RFQ;
- select the firm, execute NDA/vendor contract and arrange payment;
- audit immutable tag `multx-audit-candidate-v0.5.0-20260809`, commit
  `620e300bce9c7d967ace6a778ba7ee84e79e5d86`;
- include the three Solidity contracts and the VPS signer protocol;
- require every Critical/High finding to be fixed and re-reviewed;
- fix or explicitly accept every Medium finding; and
- obtain a final report and remediation confirmation.

**What we do:** Deliver the RFQ, threat model, Slither triage, 76 Hardhat tests,
12 Foundry invariants, bytecode hashes and signer runbooks; answer questions;
implement fixes; publish a new immutable tag rather than moving the audited
tag.

**Message to client:**

> Please approve the MultX security-audit RFQ with a maximum budget of USD
> [AMOUNT] and either select [FIRM] or confirm "run the RFQ." The client will
> own the NDA, vendor contract and payment. We will deliver the frozen v0.5
> candidate, manage the technical review and remediation, and keep MultX
> disabled until the final report and fix review are approved.

## 2. Independent fixed-supply patch review

**Who can complete it:** An independent Cosmos SDK/Evmos consensus engineer or
specialist security firm selected by the client. The author of the patch must
not be its only reviewer.

**Required:** Review the supply cap, mint paths, distribution invariants,
staking/reward behavior, fee handling, burn behavior, upgrades and failure
modes against:

- patch SHA-256
  `c6ff09423fae76251444633d50134647000e6296bdf29fafafaee830def0373f12`;
- deployed binary SHA-256
  `0546677a9cf3a7f458797b65181a46f21c89185933e832d89ce728a144fd258c`;
- chain `lithosphere_9005-1`, EVM chain ID `9005`; and
- sealed one-billion-LITHO genesis accounting.

**What we do:** Supply the patch, technical review, genesis/hash evidence and
reproduction commands; address findings without altering live consensus until
a separately approved upgrade procedure exists.

**Message to client:**

> Please appoint an independent Cosmos/Evmos reviewer for the LITHO fixed-supply
> patch. The review must reference the supplied patch and deployed-binary
> SHA-256 values and provide a dated written conclusion covering minting,
> rewards, fees, burns and upgrade safety. We will supply the complete technical
> evidence and handle any remediation.

## 3. Expansion to 33+ consensus validators

**Who can complete it:** The client ecosystem/validator lead recruits the
operators. Each operator generates and controls its own infrastructure and
private keys. Our team validates and coordinates activation.

**Required from at least 32 independent operators:**

- completed public
  `validator-expansion/validator-intake.template.csv` records;
- unique operator EVM/LITHO addresses, consensus public keys and node IDs;
- sentry endpoints, hosting provider, region and failure domain;
- approved self-delegation and commission values;
- security contact and infrastructure/security/backup attestations; and
- funded operator accounts and signed approval references.

Private keys, mnemonics and recovery material are prohibited from the intake.
Running 32 additional keys under one operator/provider does not satisfy the
security objective.

**What we do:** Validate all records, verify synchronization before signing,
review every create-validator transaction and onboard in waves of 3, 3, 6, 8
and 12+, with the documented 24-hour to seven-day observation windows.

**Message to validator candidates:**

> LITHO mainnet is onboarding independent validators for chain
> `lithosphere_9005-1` (EVM 9005). Please complete the supplied public intake
> form, including your unique operator/consensus identities, sentry topology,
> provider/region, self-delegation, commission policy and security/backup
> attestations. Do not send any private key, mnemonic or recovery material. A
> record is accepted only after technical review, synchronization and the
> controlled onboarding window.

## 4. Mainnet monitoring and paging activation

**Who can complete it:** A repository/environment administrator enters the
protected values. The client names primary and backup 24/7 responders. Our team
tests the controls.

**Required in GitHub environment `litho-mainnet-monitoring`:**

- secret `MONITOR_SSH_KEY` for a dedicated restricted read-only identity;
- secret `MONITOR_KNOWN_HOSTS` from independently verified SSH host keys;
- variable `MONITOR_SSH_USER`; and
- an approved Alertmanager/on-call route with primary and backup owners.

**What we do:** Activate the five-minute three-node progression check, load the
Prometheus no-block/signing/peer rules through private metrics access, simulate
a test failure and retain delivery evidence.

**Message to administrator/client:**

> Please configure the GitHub environment `litho-mainnet-monitoring` with
> `MONITOR_SSH_KEY`, `MONITOR_KNOWN_HOSTS` and `MONITOR_SSH_USER`, and name the
> primary and backup on-call responders. Enter protected values directly in
> GitHub, not in chat. Once complete, reply only: "mainnet monitoring secrets
> configured." We will run access validation and a controlled alert-routing
> test.

## 5. Current validator signing-state backup

**Who can complete it:** Two independent client recovery custodians perform the
offline ceremony. A GitHub administrator configures protected public-recipient
and SSH values. Our team installs and tests the export-only control.

**Required:**

- generate one recovery key and its public recipient on an offline device;
- store the recovery key in two separately controlled encrypted offline copies;
- create a dedicated backup SSH key and provide only its public key for server
  installation;
- configure GitHub environment `litho-mainnet-backup` with
  `BACKUP_SSH_KEY`, `BACKUP_KNOWN_HOSTS`, `BACKUP_RECIPIENT`, and optional
  `BACKUP_HOST`/`BACKUP_SSH_USER` variables; and
- approve an isolated verification drill that never starts `lithod`.

**What we do:** Deploy the forced-command export identity, run the six-hour
ciphertext-only workflow, verify hashes and captured height, and guide the
offline drill. The recovery private key never comes to us or GitHub.

**Message to custodians/administrator:**

> Please nominate two independent recovery custodians and perform the supplied
> signing-state recipient ceremony on an offline device. Keep both recovery-key
> copies offline. Add only the public recipient plus the dedicated backup SSH
> credentials to the protected `litho-mainnet-backup` environment; do not send
> them through chat. Once configured, reply: "backup custodians and protected
> environment configured." We will install the export-only account, run the
> first encrypted backup and coordinate a non-signing verification drill.

## 6. MultX governance and custody manifest

**Who can complete it:** Client security, custody and governance owners.

**Required public decisions:** Safe signers and threshold; 48-hour timelock
proposer/executor/canceller; separate pause guardian; deployment and fee-payer
addresses for LITHO, Ethereum, BNB and Base; ownership-transfer acceptance; and
emergency pause/escalation owners. Supply addresses only, never signing keys.

**What we do:** Validate unique roles and chain IDs, deploy governance before
bridges after audit approval, transfer ownership, verify every role on-chain and
commit a sanitized manifest.

**Message to client custody/security:**

> Please approve and provide the public MultX governance addresses and role
> assignments for all four mainnets: Safe members/threshold, timelock roles,
> separate pause guardian, deployer and fee payer. Do not share private keys.
> We will validate separation of duties and use the approved manifest only
> after the audit/remediation gate clears.

## 7. Seven independent MultX bridge signer operators

**Who can complete it:** Client security lead recruits seven independent
operators; each operator controls one rootless VPS signer and key.

**Required:** Seven unique EVM validator addresses and independent keys; 5-of-7
threshold approval; TLS 1.3 mTLS identities; source-event and route policies;
anti-equivocation storage; encrypted backups; monitoring; incident contacts;
and recovery-test evidence. These are bridge signers, not the 33 consensus
validators.

**What we do:** Deploy immutable signer images without AWS/KMS, validate mTLS
rejection and route policy, test source-event verification and persistence, and
prepare validator-set constructor/rotation records.

**Message to client:**

> Please nominate seven independent MultX bridge-signer operators and approve a
> 5-of-7 threshold. For each operator we need only the public validator address,
> infrastructure/security contact and backup/monitoring attestations. Operators
> must retain their own keys; no key may be sent to the coordinator or through
> chat. We will provide and test the rootless mTLS signer package after audit
> approval.

## 8. MultX routes, limits, endpoints and gas funding

**Who can complete it:** Client product/economic owner approves assets and
limits; custody funds deployment/fee accounts; infrastructure owners approve
RPC providers.

**Required:** Approved LITHO/Ethereum/BNB/Base HTTPS and WSS endpoints; audited
bridge/wrapped-token addresses after deployment; supported assets and both
directions for every route; daily caps; bounded canary amount; CORS origins;
and funded gas accounts. The production manifest rejects placeholders,
testnets, missing chains, zero addresses and mismatched routes.

**What we do:** Validate the manifest, deploy contracts initially paused,
verify constructor-linked bytecode, run the bounded canary, reconcile both
chains and pause again for approval.

**Message to client:**

> Please approve the MultX mainnet asset list, bidirectional routes, daily caps,
> canary limit, RPC/WSS providers and gas-funding owners for LITHO 9005,
> Ethereum 1, BNB 56 and Base 8453. Contract addresses will be populated only
> from the audited deployments. MultX will remain disabled until the paused
> canary and reconciliation receive written approval.

## 9. Chain-ID registration evidence

**Who can complete it:** The client or party that registered chain ID 9005.

**Required:** Public registry URL/PR, acceptance email or ticket identifier,
submission and acceptance dates, registered network name and confirmation that
it is EVM chain ID 9005. Do not send account credentials.

**What we do:** Verify the public record and link it in the mainnet handoff.

**Message to client:**

> Please provide the public registry link, PR or acceptance reference proving
> that LITHO EVM chain ID 9005 was registered, including the registered network
> name and acceptance date. We need evidence only—no registry credentials.

## 10. Economic and governance ownership record

**Who can complete it:** Client leadership and the designated economic or
governance owner.

**Required:** Purpose/owner label for each genesis allocation wallet; confirmed
fee distribution and burn policy; governance proposal/voting owners; emergency
economic-change authority; and confirmation that no unapproved security
reserve or unlimited minting exists. These are records, not a genesis change.

**What we do:** Reconcile decisions with the sealed one-billion-token genesis
and fixed-supply implementation, then update the public handoff without exposing
custody details.

**Message to client:**

> Please provide an auditable purpose/owner label for each genesis allocation
> wallet and approve the transaction-fee, protocol-burn and governance ownership
> policy. We will reconcile the record against the sealed one-billion-LITHO
> supply. No private custody information or genesis modification is requested.

## 11. Operational drills and raw-port closure

**Who can complete it:** Client maintenance approver, integration consumers and
our infrastructure team together.

**Required:** Written maintenance window and rollback authority; confirmation
that every integration uses TLS hostnames; approved restore/failover and
transaction test cases; observers; and acceptance criteria.

**What we do:** Exercise sentry failover, service restart, transaction path,
monitoring notification and isolated restore verification; close obsolete raw
RPC/REST/gRPC/EVM ports after consumer confirmation; preserve P2P access and
record before/after port scans.

**Message to client/integration teams:**

> Please confirm that all consumers have migrated to the approved TLS endpoints
> and approve a maintenance window for failover, restart, transaction,
> monitoring and isolated restore drills. After confirmation we will restrict
> obsolete raw service ports, retain required P2P traffic and provide rollback
> plus before/after verification evidence.

## 12. Lithoscan synchronization closeout

**Who can complete it:** The explorer/indexer team monitors the existing
process. No client credential is currently required unless the indexer reports
an infrastructure failure.

**Required:** Continue synchronization until lag is within the approved
threshold; confirm the index height advances, `inconsistentBlocks` remains zero,
API/UI health passes and chain identity remains EVM 9005 / Cosmos
`lithosphere_9005-1`.

**What we do:** Recheck the public chain and explorer, record final heights and
run smoke tests. Do not claim catch-up while `isSyncing` remains true.

**Message to explorer team:**

> LITHO mainnet and Lithoscan are healthy, but the indexer is still catching up.
> Please keep synchronization running and notify us if indexed height stops
> advancing or errors appear. We will close the gate only after lag reaches the
> approved threshold, inconsistent blocks remain zero and the final public
> smoke tests pass.

## Recommended execution order

1. Client authorizes the MultX RFQ and fixed-supply reviewer.
2. Validator recruitment, monitoring setup and backup custody begin in
   parallel.
3. Client supplies MultX governance, signer, route and economic decisions while
   the audit runs.
4. Our team completes monitored validator waves and operational drills.
5. Audit fixes receive independent re-review and a new immutable release.
6. MultX contracts deploy paused; the bounded canary runs and pauses again.
7. Written activation approval is required before enabling MultX. Bridge,
   Swap and Faucet retain their separate approval gates.

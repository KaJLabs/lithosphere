# Quantt integration acceptance record

- **Workstream:** MX-05
- **Environment:** Makalu explorer and API
- **Status:** Fail-closed; Quantt owner inputs and TLS repair required
- **Last verified:** 2026-08-14

This is the activation and acceptance record for the Quantt explorer integration. Similar-looking domains, guessed
paths, inferred authentication, and inferred response fields are not acceptable evidence.

## Verified public state

| Surface | Result | Evidence |
| --- | --- | --- |
| Makalu status | PASS (disabled) | `https://makalu.litho.ai/api/quantt/status` returns HTTP 200 with `configured: false` and `apiOrigin: null`. |
| Research portal | PASS | `https://research.quantt.at/` returns HTTP 200 with title `Quantt Agents Research`. |
| Requested developer portal | FAIL | A standards-valid HTTPS request to `https://dev.quantt.at/` fails hostname verification. |
| Developer DNS | OBSERVED | `dev.quantt.at` resolves to `91.236.195.168` at verification time. |
| Presented certificate | WRONG HOST | Certificate subject is `CN=dev.quantts.ai`; SANs cover `api.quantts.ai`, `dev.quantts.ai`, `engine.quantts.ai`, and `enterprise.quantts.ai`, but not `dev.quantt.at`. |

The similarly named `https://dev.quantts.ai/` currently returns HTTP 200 and `https://api.quantts.ai/` returns HTTP
404 at its root. They are observations only. Neither domain is approved as the Lithosphere integration API, and the
explorer must not switch to them without Quantt-owner confirmation.

## Repository integration boundary

The explorer contains a disabled research page and a server-only API proxy. Credentials are never sent to the
browser. Activation requires all of these explicit server settings:

| Setting | Required owner input |
| --- | --- |
| `QUANTT_API_BASE_URL` | Approved HTTPS API origin under the approved Quantt domain. |
| `QUANTT_API_KEY` | Credential delivered through the deployment secret manager, never chat or source control. |
| `QUANTT_API_AUTH_HEADER` | Exactly `authorization` or `x-api-key`, confirmed by Quantt. |
| `QUANTT_INSIGHTS_PATH` | Exact approved path beginning with one `/`. |
| `QUANTT_API_TIMEOUT_MS` | Optional; bounded by the adapter to 1–30 seconds. |

The adapter does not default the auth scheme or insights path. It rejects HTTP, userinfo, query/hash-bearing base
URLs, unrelated hostnames, protocol-relative paths, and malformed symbols. The upstream credential remains
server-side and sanitized errors do not return it to clients.

## Inputs still required from Quantt

- [ ] Confirm the canonical production and development hostnames; explicitly state whether any `quantts.ai` host is
      intended to replace the requested `quantt.at` host.
- [ ] Repair the `dev.quantt.at` DNS/certificate binding or retire that URL in writing.
- [ ] Provide the exact base URL, HTTP method, insights path, authentication scheme, and credential through the
      approved secret manager.
- [ ] Provide the versioned request/response schema, required headers, supported symbols, score units/range,
      timestamp semantics, rate limits, timeout/retry guidance, and cache policy.
- [ ] Provide non-secret success and error fixtures plus a test credential or sandbox access.
- [ ] Name the Quantt technical approver and incident/contact channel.

## Controlled activation sequence

1. Review the owner-supplied API contract and replace the provisional response normalizer with the exact versioned
   schema mapping and validation.
2. Add contract fixtures for success, authentication failure, rate limiting, timeout, malformed JSON, oversized
   response, and upstream 5xx behavior.
3. Repair/validate the developer TLS endpoint and record certificate hostname/expiry evidence.
4. Add the approved non-secret settings and secret-manager credential to the Makalu deployment environment.
5. Deploy an immutable release through the protected core workflow; do not modify the faucet.
6. Confirm `/api/quantt/status` reports configured without exposing the key, then run bounded live insight tests.
7. Test the explorer's loading, empty, error, stale/cache, and successful result states.
8. Record Quantt and Dev Infra acceptance below.

## Acceptance criteria

- [ ] Canonical hosts pass DNS, certificate-chain, hostname, and HTTPS checks.
- [ ] The implemented request and response mapping matches a versioned owner-approved contract.
- [ ] Credentials exist only in the secret manager/API process and are absent from responses, logs, and browser
      assets.
- [ ] Rate limits, timeouts, response-size bounds, retry behavior, caching, and error translation are tested.
- [ ] A live LITHO request returns the expected mapped result through the Makalu explorer.
- [ ] Disable/rollback behavior is tested and documented.
- [ ] Quantt and Dev Infra approvers, date, release, and evidence are recorded.

## Evidence and approval

| Field | Value |
| --- | --- |
| Repository PR | Pending |
| Merge commit | Pending |
| Deployment run/release | Pending |
| Quantt contract/version | Pending |
| Live test artifact | Pending |
| Quantt approver/date | Pending |
| Dev Infra approver/date | Pending |

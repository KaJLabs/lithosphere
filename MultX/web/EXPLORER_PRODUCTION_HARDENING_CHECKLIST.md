# Kamet Explorer Production Hardening Checklist

Updated: 2026-04-20

Scope: frontend and edge hardening steps for the `kamet-explorer` app. This complements the release checklist and is focused on deploy-time trust and safety controls rather than feature behavior.

## Repo-Local Controls Already Implemented

- CSP headers are defined in `nginx.conf`.
- Security response headers are defined for frame protection, content sniffing, referrers, permissions policy, cross-origin isolation hints, and HSTS.
- Hidden files and dotfiles are denied by the default Nginx config.
- Static SPA routes only allow `GET`, `HEAD`, and `OPTIONS`.
- Repo-local Nginx redirects plain HTTP requests to HTTPS for non-local-development hosts.
- Repo-local Nginx applies request-rate limiting to SPA document routes and static assets, returning `429` on burst overflow.
- Search input is sanitized before routing and lookup.
- Contract ABI parsing is guarded so malformed payloads do not crash the UI.
- Explorer routes use friendly invalid and unsupported states instead of leaking raw backend failures.
- Client-side monitored error wiring exists behind `VITE_SENTRY_DSN`.
- Local Docker verification of the shipped config passed on 2026-04-20 with:
  - `HEALTH:200:healthy`
  - `REDIRECT:HTTP/1.1 308 Permanent Redirect:Location: https://kamet.litho.ai/`
  - `RATE_LIMIT:429=115;200=45;total=160`

## Pre-Release Hardening Checks

### Edge and Response Headers

- Confirm the deployed frontend returns:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
  - `X-Permitted-Cross-Domain-Policies`
- Confirm deep links still work through the same edge config after header changes.

### Environment Hygiene

- Confirm `VITE_EXPLORER_DATA_API_URL` points only to a public explorer data API.
- Confirm `VITE_STATUS_API_URL` and `VITE_STATUS_METRICS_URL` point only to public status endpoints.
- Confirm wallet, RPC, REST, and footer URLs do not expose internal hostnames.
- Confirm `VITE_SENTRY_DSN` is set only in environments where monitored client errors are intended.

### UI Exposure Review

- Confirm no mock-data toggles or debug-only controls are reachable in production routes.
- Confirm no admin or indexer-only URLs are rendered in the public UI.
- Confirm raw JSON payload disclosures only show public API responses that are already user-safe.
- Confirm write-contract UI remains locked unless a wallet is connected on Kamet.

### Search and Rendering Safety

- Confirm malformed hashes and addresses do not crash route pages.
- Confirm unsupported object types show a safe explanatory state.
- Confirm malformed contract ABIs degrade gracefully without rendering arbitrary HTML.

## External or Infra-Owned Controls

These still depend on deployment topology or backend ownership and are not solved end to end by this frontend repo alone.

- Roll out the repo Nginx config, or equivalent HTTPS-redirect and rate-limit rules, at the active load balancer, ingress, CDN, or TLS-terminating proxy.
- Rate-limit public APIs at the backend or edge in addition to the shipped document and asset limits.
- Enable WAF, bot mitigation, or CDN shielding if required by production policy.
- Keep TLS certificates, DNS, and HSTS preload enrollment under infra ownership.

## Quick Verification Commands

Use these after deployment:

```powershell
curl -I http://kamet.litho.ai
curl -I https://kamet.litho.ai
curl -I https://kamet.litho.ai/block/1
curl -I https://kamet.litho.ai/health
```

Confirm the expected security headers are present, plain HTTP redirects to HTTPS, deep links do not return a raw server 404, and the live deployment reflects the shipped edge policy.

For a quick burst-limit spot check after rollout:

```powershell
1..160 | ForEach-Object { Start-Job { try { (Invoke-WebRequest -UseBasicParsing https://kamet.litho.ai/).StatusCode } catch { $_.Exception.Response.StatusCode.value__ } } } | Receive-Job -Wait -AutoRemoveJob
```

## Related Docs

- `EXPLORER_RELEASE_CHECKLIST.md`
- `EXPLORER_TRIAGE_RUNBOOK.md`
- `EXPLORER_IMPLEMENTATION_STATUS.md`

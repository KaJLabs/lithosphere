# Lithoscan production cutover record — 2026-07-29 to 2026-07-31

Approved application release:
`751d4f7092ef69577075ab0905134bb112031dc9`.

## Production state

- Production UI is healthy on loopback-only `127.0.0.1:3500`.
- Production API is healthy on loopback-only `127.0.0.1:4400`.
- The root-owned production vhost at
  `/etc/nginx/lithoscan-mainnet/lithoscan.ai.conf` is enabled.
- The vhost routes `/` to the production UI and `/api/` to the production API.
- The HTTP-only ACME bootstrap vhost is disabled after successful activation.
- The updated root-owned wrapper is installed at
  `/usr/local/sbin/lithoscan-nginx-cutover` with mode `0755`. Its SHA-256 is
  `47db22ceb513755d133d27e59996b3bedb90af6800f80fc7fe4efa8767ffb475`.
- `lithoscan-deploy` has passwordless sudo access only to
  the wrapper's exact `install-certificate`, `status`, `test`, `activate`,
  `reload`, and `rollback` commands.
- The installed sudoers policy is root-owned with mode `0440`. Its SHA-256 is
  `1ac6da497faa5295a12987b9f3db6e1e83c39dd648b01f97b2c20e037f8c90c4`,
  and the complete live sudoers configuration passes `visudo` validation.
- The generic passwordless root `install` command remains denied.
- A Cloudflare Origin CA certificate for `lithoscan.ai` is installed at the
  fixed root-owned paths. The certificate/key match and hostname validation
  passed; the certificate is valid from 2026-07-29 through 2041-07-25.
- The `lithoscan-mainnet` GitHub environment uses `DEPLOY_USER=lithoscan-deploy`.
  Its deployed ED25519 public-key fingerprint is
  `SHA256:lU1gNOeca2CphDfsiZu6dSHF+0wS79z5F4cFHHyRHPo`; the private half exists only
  in the protected GitHub environment secret after temporary-key cleanup.
- The application `.env` remains owned by `lithoscan-mainnet-deploy`; its group
  is `lithoscan-deploy` and mode is `0640`, allowing the workflow to validate
  the release marker without changing the application owner.
- `makalu.litho.ai` was not modified.

The production vhost and Cloudflare edge cutover were completed on 2026-07-31.
Activation and reload remain deliberately separate operations for rollback and
future maintenance.

## Cutover completed

The origin certificate, Nginx activation, and coordinated Cloudflare cutover
are complete. `lithoscan.ai` no longer redirects to Makalu. Cloudflare serves
the production UI and API over valid edge TLS, while the origin uses the
installed Cloudflare Origin CA certificate.

Never send an API token or private key through chat.

## Restricted certificate installation

The generic root `install` command remains intentionally denied. The deployment
identity may stage the two secrets only at these fixed paths:

```text
/opt/lithoscan-mainnet/tls-staging/fullchain.pem
/opt/lithoscan-mainnet/tls-staging/privkey.pem
```

The staging directory must be owned by `lithoscan-deploy` with mode `0700`;
both files must be owned by `lithoscan-deploy`, regular non-linked files, and
mode `0600`. The workflow should write them with `umask 077`, then run:

```bash
umask 077
printf '%s\n' "$LITHOSCAN_TLS_CERT" \
  > /opt/lithoscan-mainnet/tls-staging/fullchain.pem
printf '%s\n' "$LITHOSCAN_TLS_KEY" \
  > /opt/lithoscan-mainnet/tls-staging/privkey.pem
chmod 0600 /opt/lithoscan-mainnet/tls-staging/fullchain.pem \
  /opt/lithoscan-mainnet/tls-staging/privkey.pem
sudo /usr/local/sbin/lithoscan-nginx-cutover install-certificate
```

The updated controls were staged at `/opt/lithoscan-mainnet/edge-control/` and
installed on the origin as root on 2026-07-29. The fixed TLS staging directory
was created as `lithoscan-deploy:lithoscan-deploy` with mode `0700`. The
following commands remain the installation reference for disaster recovery:

```bash
deploy_group=$(id -gn lithoscan-deploy)
install -o root -g root -m 0755 \
  monitoring/lithoscan-mainnet/lithoscan-nginx-cutover \
  /usr/local/sbin/lithoscan-nginx-cutover
install -o root -g root -m 0440 \
  monitoring/lithoscan-mainnet/lithoscan-nginx-cutover.sudoers \
  /etc/sudoers.d/lithoscan-nginx-cutover
install -d -o lithoscan-deploy -g "$deploy_group" -m 0700 \
  /opt/lithoscan-mainnet/tls-staging
visudo -cf /etc/sudoers.d/lithoscan-nginx-cutover
```

The restricted command atomically claims the uploads into a root-only
directory before reading them, validates PEM parsing, certificate validity,
the `lithoscan.ai` hostname, and the certificate/private-key public-key match,
then installs:

```text
/etc/letsencrypt/live/lithoscan.ai/fullchain.pem  root:root 0644
/etc/letsencrypt/live/lithoscan.ai/privkey.pem    root:root 0600
```

It does not activate or reload Nginx. Uploads that fail validation are not
installed and must be staged again after correcting the secret values.

### Installation evidence

GitHub Actions run `30477318231`, attempt 3, job `90769674200` completed
successfully on 2026-07-30. It validated the approved release, certificate and
key, deployment SSH identity, helper checksum, restricted sudo boundary,
backends, inactive vhost, public redirect, installation, and staging cleanup.

Independent origin verification confirmed:

- certificate SHA-256 fingerprint
  `4D:05:93:1E:9F:72:01:A7:D1:E3:A3:3B:08:75:03:38:2B:68:C8:B8:7D:96:A5:E9:7C:EE:4A:B8:69:18:0A:9A`;
- `fullchain.pem` is `root:root` mode `0644`;
- `privkey.pem` is `root:root` mode `0600`;
- `tls-staging` is `lithoscan-deploy:lithoscan-deploy` mode `0700` and empty;
- the certificate and key match and the certificate covers `lithoscan.ai`;
- production UI and API backends are healthy; and
- the production vhost remained inactive during certificate installation.

### Cutover evidence — 2026-07-31

- The enabled vhost SHA-256 is
  `bf6fc366d92cf6f4078fd7792a43bc11ae0eb3d4566f9cab8680d7fb37f0a0da`.
- The final API routing preserves normal `/api/*` paths and maps only
  `/api/health` to the backend root health endpoint.
- Public `/`, `/api/health`, and `/api/stats/summary` returned HTTP `200`
  through Cloudflare with no Makalu redirect.
- Public health reported release
  `sha-751d4f7092ef69577075ab0905134bb112031dc9` in `production`.
- All production UI, API, indexer, PostgreSQL, and Redis containers were
  healthy; Nginx was active and reported no errors during the monitoring
  sample.
- Four monitoring samples showed indexed height advancing from `541379` to
  `541417`, lag between `5` and `29` blocks, and zero inconsistent blocks.
- The restricted helper reported the candidate, certificate, and private key
  present, the production vhost active, and both backends healthy.

### Formal closeout re-verification — 2026-07-31

The initial closeout report alerted because two indexed-block ages were
slightly negative (`-0.29s` and `-2.19s`). All functional and synchronization
gates passed. Origin NTP synchronization was confirmed, API and indexer
containers shared the origin clock, and fresh public RPC block ages were below
`1.2s`. The alert was classified as a bounded clock-skew false positive.

The freshness gate was re-evaluated with an explicit accepted interval of
`-5s` through `120s`, which continues to reject stale or materially
future-dated blocks. Three fresh samples passed at `12:53:52`, `12:54:23`, and
`12:54:55` UTC. Indexed height advanced from `548822` to `548948`, lag decreased
from `10` to `6` blocks, and block ages were `6.944s`, `5.745s`, and `4.701s`.
Core routes, both chain IDs, RPC health, `isSyncing=false`, zero inconsistent
blocks, and disabled Faucet, Bridge, Swap, and MultX endpoints all passed.

No rollback or production configuration change was required for this alert.
The machine-readable closeout evidence is recorded in
`lithoscan-window-close.json`; the monitoring window is formally closed.

## Coordinated origin commands

```bash
sudo /usr/local/sbin/lithoscan-nginx-cutover install-certificate
sudo /usr/local/sbin/lithoscan-nginx-cutover status
sudo /usr/local/sbin/lithoscan-nginx-cutover test
sudo /usr/local/sbin/lithoscan-nginx-cutover activate
sudo /usr/local/sbin/lithoscan-nginx-cutover reload
```

Rollback:

```bash
sudo /usr/local/sbin/lithoscan-nginx-cutover rollback
```

The executed cutover order was: validate certificate and backends; activate
and reload the origin while the Cloudflare redirect remained; remove the edge
redirect; run public UI, API, TLS, release, and synchronization checks; and
monitor block progression. Rollback remains edge first and origin second if a
later gate fails.

Bridge, Swap, Faucet, and MultX remain disabled.

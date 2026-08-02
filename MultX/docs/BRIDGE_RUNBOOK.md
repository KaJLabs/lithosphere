# MultX Bridge Operator Runbook

> **Migration notice (2026-08-02):** This is a historical Makalu/Kamet
> operational record. Its AWS/KMS hosts, paths and custody assumptions are
> superseded by the VPS-only infrastructure direction. Do not execute it on
> LITHO mainnet; MultX remains disabled pending a revised runbook and audit.

> **Classification**: Internal — Infrastructure Operations Team
> **Bridge contract (Kamet)**: `0x3a896BDF3a1088287FA84aB5a43bB30e2535F263`
> **Owner key**: deployer `0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF` (single EOA for now — recommend Gnosis Safe before mainnet dest-chain deploys; see threat-model L1)
> **Validators**: 5-of-7 multisig with historical AWS KMS custody (see [`VALIDATOR_KEY_ROTATION.md`](./VALIDATOR_KEY_ROTATION.md))
> **Last reviewed**: 2026-06-10

---

## 1. Purpose & Scope

This runbook governs operator actions on the MultX bridge contract and the
bridge-api signing service. It assumes you already understand the bridge
architecture documented in [`../audit/MULTX_THREAT_MODEL.md`](../audit/MULTX_THREAT_MODEL.md).

**In scope:**
- Emergency pause and unpause
- Validator set rotation (planned and emergency)
- Daily-cap management per token
- Incident response: validator key compromise, dest-chain bug, RPC outage
- Verifying post-action state on-chain

**Out of scope** (use these docs instead):
- KMS-specific key generation/retirement procedure → [`VALIDATOR_KEY_ROTATION.md`](./VALIDATOR_KEY_ROTATION.md)
- Contract redeployment / upgrade — bridge is immutable; major changes require new deploy + migration plan
- Validator infra operations (sentry/validator nodes) → [`../INCIDENT_RUNBOOK.md`](../INCIDENT_RUNBOOK.md)
- General security incidents → [`../INCIDENT_RUNBOOK.md`](../INCIDENT_RUNBOOK.md)

**Related documents:**
- [`../audit/MULTX_THREAT_MODEL.md`](../audit/MULTX_THREAT_MODEL.md) — architecture, trust assumptions, invariants
- [`VALIDATOR_KEY_ROTATION.md`](./VALIDATOR_KEY_ROTATION.md) — KMS key lifecycle
- [`../INCIDENT_RUNBOOK.md`](../INCIDENT_RUNBOOK.md) — general incident response
- [`../CUSTODY_CONTACTS.md`](../CUSTODY_CONTACTS.md) — escalation matrix

---

## 2. Prerequisites

Every operator command below assumes:

- **Owner key access**: deployer private key in `contracts/.env` (`DEPLOYER_PRIVATE_KEY`) — same wallet used to call `pause` / `setValidatorSet` / `setDailyCap` / `addSupportedToken`. Currently a single EOA; gating on this happens at the wallet-custody layer.
- **AWS access**: `litho-infra-terraform` IAM user (or whichever IAM is used) with `kms:Sign`, `kms:GetPublicKey`, `iam:PutRolePolicy` for validator rotations.
- **Network access**: ability to reach `rpc-3.litho.ai` (or any other Kamet RPC endpoint) — the action does not require the bastion since it's a public RPC.
- **A scratch directory** with the contracts repo checked out: `cd contracts && node ...`

All commands below use plain `node` with `ethers` v5 — same pattern as the cutover scripts that have already been executed.

---

## 3. Emergency pause / unpause

### 3.1 When to pause

Pause the bridge IMMEDIATELY if any of the following is true:

| Trigger | Severity | Detection signal |
|---|---|---|
| Unexpected `TokensReleased` event on Kamet from a `sourceTxHash` we cannot trace back to a corresponding dest-chain `TokensLocked` | **P0** — possible exploit in progress | Indexer alert / manual inspection |
| Validator signing key compromise suspected (host intrusion, AWS account compromise, IAM leak) | **P0** | Out-of-band notification, AWS GuardDuty, log analysis |
| Dest-chain bridge contract is paused by its owner (us) AND there is in-flight lock activity on Kamet | **P1** | Dest-chain observation |
| Anomalous lock volume (>10× typical hourly volume in <30 min) without a clear cause | **P1** | Volume alerts |
| Validator service fails to sign for >30 minutes across all 7 validators | **P2** — degraded service, not an active exploit | `bridge-api` health logs |

### 3.2 Pause procedure

**Worked example** — the 2026-05-19 KMS cutover ran exactly this sequence:

```bash
cd contracts
node -e "
const { ethers } = require('./dnns/node_modules/ethers');
const ABI = [
  'function pause() external',
  'function paused() view returns (bool)',
];
(async () => {
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
  const p = new ethers.providers.StaticJsonRpcProvider('https://rpc-3.litho.ai', { chainId: 900523, name: 'kamet' });
  const signer = wallet.connect(p);
  const bridge = new ethers.Contract('0x3a896BDF3a1088287FA84aB5a43bB30e2535F263', ABI, signer);

  console.log('Pre-pause paused state:', await bridge.paused());
  const tx = await bridge.pause();
  console.log('Pause tx hash:', tx.hash);
  await tx.wait();
  console.log('Post-pause paused state:', await bridge.paused());
})();
"
```

Expected output: `false` → tx hash → `true`. Confirmation usually within 2 blocks (~2s on Kamet).

**Reference txs** (from the May-19 cutover):
- Pause: `0x79b3393cec50ab5e6c9e2a0027af21a5009c28b0d656100b0c6601a52c1efb09`
- Unpause: `0x0b6b03248079e239e67dc6a3361dfc7eb77cef907c0f3ab1ee4b0a778542b7a6`

### 3.3 What pause does

- All `lockTokens` calls revert with `Pausable: paused`.
- All `releaseTokens` calls revert with `Pausable: paused`.
- The validator service **does NOT pause** — it continues signing in-flight rows that were already in `locked` status. These signatures remain valid; they will be usable for release if/when we unpause and the user submits the release tx.
- Daily caps, validator set, supported tokens, ownership — all unaffected.
- Event listeners on each chain keep polling — no state is lost.

### 3.4 During the pause

1. **Communicate** — post in #litho-bridge-ops with the trigger, expected duration, and incident severity.
2. **Diagnose** — identify root cause. Common scenarios in §6 below.
3. **Decide** — fix-then-unpause or contract-redeploy. Bridge is immutable; if the contract itself is the problem, only option is redeploy under a new address.

### 3.5 Unpause procedure

Once root cause is fixed and verified:

```bash
node -e "
const { ethers } = require('./dnns/node_modules/ethers');
const ABI = ['function unpause() external', 'function paused() view returns (bool)'];
(async () => {
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
  const p = new ethers.providers.StaticJsonRpcProvider('https://rpc-3.litho.ai', { chainId: 900523, name: 'kamet' });
  const bridge = new ethers.Contract('0x3a896BDF3a1088287FA84aB5a43bB30e2535F263', ABI, wallet.connect(p));
  const tx = await bridge.unpause();
  console.log('Unpause tx:', tx.hash);
  await tx.wait();
  console.log('Final paused state:', await bridge.paused());
})();
"
```

### 3.6 Post-unpause checklist

- [ ] `paused()` returns `false`
- [ ] First post-unpause lock succeeds (smoke test with 1 wei or 0.01 of any token)
- [ ] Bridge-api logs show normal signing activity
- [ ] Incident retrospective scheduled

---

## 4. Validator set rotation

### 4.1 Planned rotation

Used for: scheduled key rotation, adding/removing operators, threshold change.

**No pause required** if the change is additive AND the threshold is unchanged
or strictly increases. **Pause required** if removing a validator while the
threshold would not remain satisfiable by remaining validators, or if any
in-flight `locked` rows risk being orphaned (signatures from the retired
validator already collected but not enough for the new threshold).

Default recommendation: **always pause for any validator-set change**. The
30-second pause window is cheap compared to the cost of an orphaned lock.

### 4.2 Worked example (2026-05-19 KMS cutover)

Sequence executed when migrating from 3 env-var validators (2-of-3) to 7 KMS
validators (5-of-7):

```bash
# Step 1: pause
node -e "..." # see §3.2

# Step 2: setValidatorSet (atomic on-chain)
node -e "
const { ethers } = require('./dnns/node_modules/ethers');
const ABI = ['function setValidatorSet(address[] _validators, uint256 _signaturesRequired) external'];
const NEW_SET = [
  '0xD9B30A7f4d58f1b98AaA69B82F0c8bF0816638FB',
  '0xEefB2E0c91Bc57975D117BADA6c70f3Cd6C4bC91',
  '0x4dFEd8e8359EaA711CdFFFcb5d994a66e46185Ac',
  '0x27026F8C232d723100700186c10B2aEbd82ea60C',
  '0xc8C5c89ddb70CAEC942f2C5A77F4F4001ef3B415',
  '0x4CDd6D160Bd79fe7d4Bab06a9E0607870e8108D9',
  '0xB161611185Ce2c95849134188AC9F5DbC26bfD2D',
];
const THRESHOLD = 5;
(async () => {
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
  const p = new ethers.providers.StaticJsonRpcProvider('https://rpc-3.litho.ai', { chainId: 900523, name: 'kamet' });
  const bridge = new ethers.Contract('0x3a896BDF3a1088287FA84aB5a43bB30e2535F263', ABI, wallet.connect(p));
  const tx = await bridge.setValidatorSet(NEW_SET, THRESHOLD);
  console.log('setValidatorSet tx:', tx.hash);
  await tx.wait();
})();
"

# Step 3: deploy new validator KMS env to bridge-api (see VALIDATOR_KEY_ROTATION.md §4)

# Step 4: unpause
node -e "..." # see §3.5
```

Total downtime: ~30 seconds (3 sequential Kamet blocks).

### 4.3 Verification after rotation

```bash
node -e "
const { ethers } = require('./dnns/node_modules/ethers');
const ABI = [
  'function getValidators() view returns (address[])',
  'function signaturesRequired() view returns (uint256)',
];
(async () => {
  const p = new ethers.providers.StaticJsonRpcProvider('https://rpc-3.litho.ai', { chainId: 900523, name: 'kamet' });
  const bridge = new ethers.Contract('0x3a896BDF3a1088287FA84aB5a43bB30e2535F263', ABI, p);
  console.log('Validators:', await bridge.getValidators());
  console.log('Threshold: ', (await bridge.signaturesRequired()).toString());
})();
"
```

Also confirm bridge-api logs show: `[ValidatorService] Loaded 7 validator(s) — KMS: 7, env-var: 0` (or whatever the new count is).

### 4.4 Rollback

If anything misbehaves after rotation, the same procedure rolls back to the
previous set. The contract owner (us) holds `setValidatorSet`. No external
approval needed. Document the previous validator set BEFORE every rotation
so a rollback is trivially scripted.

---

## 5. Daily-cap management

### 5.1 Concepts

Each supported token can have a per-token daily volume cap. `dailyCap[token] = 0`
means unlimited (default). Each `lockTokens` call checks: if 24h has passed
since `lastCapReset[token]`, reset `dailyVolume[token] = 0`. Then require
`dailyVolume[token] + amount <= dailyCap[token]`.

### 5.2 Setting a cap

```bash
node -e "
const { ethers } = require('./dnns/node_modules/ethers');
const ABI = ['function setDailyCap(address token, uint256 cap) external'];
(async () => {
  const TOKEN = '0xC0FC628e3aB128fe387e7ed5e729bD809C017888'; // wLITHO
  const CAP = ethers.utils.parseUnits('100000', 18); // 100,000 wLITHO/day
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
  const p = new ethers.providers.StaticJsonRpcProvider('https://rpc-3.litho.ai', { chainId: 900523, name: 'kamet' });
  const bridge = new ethers.Contract('0x3a896BDF3a1088287FA84aB5a43bB30e2535F263', ABI, wallet.connect(p));
  const tx = await bridge.setDailyCap(TOKEN, CAP);
  console.log('Daily-cap tx:', tx.hash);
  await tx.wait();
})();
"
```

### 5.3 Monitoring remaining headroom

```bash
node -e "
const { ethers } = require('./dnns/node_modules/ethers');
const ABI = ['function getDailyRemaining(address token) view returns (uint256)'];
const TOKEN = '0xC0FC628e3aB128fe387e7ed5e729bD809C017888';
(async () => {
  const p = new ethers.providers.StaticJsonRpcProvider('https://rpc-3.litho.ai', { chainId: 900523, name: 'kamet' });
  const bridge = new ethers.Contract('0x3a896BDF3a1088287FA84aB5a43bB30e2535F263', ABI, p);
  const rem = await bridge.getDailyRemaining(TOKEN);
  console.log('Remaining today:', ethers.utils.formatUnits(rem, 18), 'wLITHO');
})();
"
```

### 5.4 Suggested defaults (pre-mainnet)

Conservative starting caps for soft launch:

| Token category | Daily cap (USD-equivalent) |
|---|---|
| Top LEP100s (wLITHO, QTT, COLLE, LitBTC) | $50,000 |
| Long-tail LEP100s | $10,000 |
| Newly added tokens (< 7 days old) | $1,000 |

Raise caps in 2x-per-week increments after observing actual volume.

---

## 6. Incident response playbooks

### 6.1 Scenario: validator key compromise

**Trigger**: AWS GuardDuty alert on a validator KMS key, IAM credential
leakage, host intrusion on a validator service, or unexpected `Sign` API
calls.

**Actions** (in order):

1. **Pause the bridge** immediately (§3.2). 30-second downtime is cheap.
2. **Identify the compromised validator** — which KMS key ARN?
3. **Disable the KMS key** (does not delete; prevents further use):
   ```bash
   aws kms disable-key --region us-east-1 --key-id <compromised-arn>
   ```
4. **Decide**: replace with a fresh key (recommended, ~1 hour) or just remove
   from the set (reduces threshold safety until next rotation).
5. **If replacing**: follow [`VALIDATOR_KEY_ROTATION.md`](./VALIDATOR_KEY_ROTATION.md) §2 to provision a new KMS key.
6. **Rotate the validator set** (§4) to swap out the compromised address for
   the new one. Same threshold.
7. **Unpause** once verification passes (§3.5, §4.3).
8. **Post-incident**: revoke any leaked IAM credentials, force-rotate AWS
   access keys, conduct retrospective per [`../INCIDENT_RUNBOOK.md`](../INCIDENT_RUNBOOK.md) §11.

**Communication**: announce on the bridge status page if downtime exceeds
5 minutes. Otherwise post-hoc retrospective is enough.

### 6.2 Scenario: dest-chain bridge contract bug suspected

**Trigger**: dest-chain explorer shows `TokensReleased` for a non-existent
or mismatched Kamet `TokensLocked`. Or: dest-chain wrapped token balance
inconsistent with `sum(mint) - sum(burn)`.

**Actions**:

1. **Pause Kamet bridge first** — even though the bug is dest-chain, pausing
   Kamet stops new locks from feeding into the broken side.
2. **Pause the dest-chain bridge** (each dest chain has its own owner key
   in `MultXBridgeDest` — same deployer for now).
3. **Reconcile**: compare Kamet `processedNonces` with dest-chain
   `TokensReleased` events. Identify the divergent tx.
4. **Snapshot the state**: capture block heights, dump validator signatures
   for the divergent tx, save to incident folder.
5. **Decide rollback path**: contract is immutable. Options are (a) redeploy
   fixed dest-chain bridge under a new address, migrate liquidity manually,
   (b) accept the loss if small and harden monitoring, (c) freeze that
   specific token via `removeSupportedToken`.
6. **Notify**: this is a P0; involve the audit firm if one is engaged.

### 6.3 Scenario: RPC brownout affecting validator signing

**Trigger**: bridge-api logs show `[ValidatorService] Signing error` repeatedly
across multiple validators; `eth_getBlockNumber` errors from the indexer's
provider; signing rate falls to zero.

**Actions** (no pause required — this is degraded service, not an exploit):

1. **Verify it's RPC, not contract**: query Kamet RPC directly via curl.
   If RPC is healthy, look at validator service logs.
2. **Failover the RPC**: bridge-api reads `LITHO_RPC_HTTP` from
   `/opt/bridge/docker-compose.yml` on indexer (`10.0.10.16`). Edit the
   env, restart `bridge-api`:
   ```bash
   ssh -J ec2-user@<bastion> ec2-user@10.0.10.16
   sudo nano /opt/bridge/docker-compose.yml
   # change LITHO_RPC_HTTP value to a healthy RPC
   sudo docker compose up -d bridge-api
   docker logs bridge-api --tail 20
   ```
3. **Drain in-flight `locked` rows**: once a healthy RPC is wired up, the
   signing loop catches up automatically. No manual intervention needed
   for the rows themselves.
4. **Update the failover RPC list** in `bridge-api/src/config.js` if this
   pattern recurs.

### 6.4 Scenario: `bridge.litho.ai` returns 501 `{"code":12,"message":"Not Implemented"}`

**Trigger**: every endpoint on `https://bridge.litho.ai` (e.g. `/health`,
`/chains`, `/bridge/status/<tx>`) returns HTTP `501` with body
`{"code":12,"message":"Not Implemented","details":[]}`. The wallet/SDK
reports the MultX backend as down.

**Root cause (diagnosed + fixed 2026-06-10)**: this body is the **Cosmos
gRPC-gateway** "unimplemented" response — it can only come from a lithod
REST/gRPC origin, **never** from the Express bridge-api (which returns a
plain `Cannot GET /...` 404 for unknown routes). `bridge.litho.ai` is
Cloudflare-proxied (orange) and Cloudflare connects to the vps2 origin over
**HTTPS `:443`**. The vps2 vhost `bridge.conf` was listening on **`:80`
only** — so the `:443` request fell through to the first `:443` server block
on the box (a Cosmos REST proxy, e.g. `api-kamet` → lithod `:1317`), which
emitted the 501.

**Diagnostic (run on vps2 — `187.124.133.209`, SSH key `~/.ssh/id_ed25519`)**:

```bash
# :80 with the right Host reaches bridge-api (correct) ...
curl -s -H "Host: bridge.litho.ai" http://127.0.0.1/quote        # -> bridge-api 404 HTML
# ... but :443 falls through to the wrong default vhost:
curl -sk --resolve bridge.litho.ai:443:127.0.0.1 https://bridge.litho.ai/health
#   broken -> {"code":12,"message":"Not Implemented","details":[]}
#   fixed  -> {"status":"ok","db":"ok"}
```

> ⚠️ Always test name-based TLS vhosts with `--resolve host:443:127.0.0.1`
> (sends the correct SNI). `curl -k -H "Host: ..."` against `127.0.0.1` sends
> SNI `127.0.0.1`, so nginx picks the **default** `:443` vhost and you get a
> misleading result.

**Fix**: add a `:443 ssl` server block to
`/etc/nginx/sites-available/bridge.conf` that proxies to the bridge-api
(`127.0.0.1:4001`). The existing `kamet.litho.ai` cert is a valid origin cert
behind Cloudflare in **Full** SSL mode (same as how `rpc-3.litho.ai` already
serves), so no new cert issuance is needed.

```bash
ssh -i ~/.ssh/id_ed25519 root@187.124.133.209
cp /etc/nginx/sites-available/bridge.conf \
   /etc/nginx/sites-available/bridge.conf.bak.$(date +%Y%m%d-%H%M%S)
cat >> /etc/nginx/sites-available/bridge.conf <<'EOF'

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bridge.litho.ai;
    server_tokens off;

    ssl_certificate     /etc/letsencrypt/live/kamet.litho.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kamet.litho.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
EOF
nginx -t && systemctl reload nginx
```

**Verify**: `curl -s https://bridge.litho.ai/health` → `{"status":"ok","db":"ok"}`.

**Rollback**: restore the `bridge.conf.bak.<ts>` backup and `systemctl reload nginx`.

**Alternative one-click fix** (no vps2 change): set Cloudflare's SSL mode for
`bridge.litho.ai` to **Flexible** (CF → origin over `:80`). The `:443` vhost
above is the cleaner, CF-mode-agnostic fix and is the deployed solution.

**Not a regression to chase**: after the fix, `/quote`, `/route`, `/execute`
still return bridge-api 404 — those are **not** bridge-api routes (real
surface in §8). Swap quotes/routing come from Ignite (`ignite.trade`), not
this API.

---

## 7. Quick-reference cheat sheet

| Action | Owner-only? | Pause required? | Downtime |
|---|---|---|---|
| `pause()` | Yes | n/a | <2s |
| `unpause()` | Yes | n/a | <2s |
| `setValidatorSet(addrs, n)` | Yes | Recommended | ~10s with pause/unpause |
| `setDailyCap(token, cap)` | Yes | No | 0 |
| `addSupportedToken(token)` | Yes | No | 0 |
| `removeSupportedToken(token)` | Yes | No | 0 |
| `lockTokens(...)` (user-facing) | No | Reverts when paused | n/a |
| `releaseTokens(...)` (user-facing) | No | Reverts when paused | n/a |

---

## 8. Appendix — addresses & references

- **Bridge contract (Kamet)**: `0x3a896BDF3a1088287FA84aB5a43bB30e2535F263` (deployed 2026-05-09; hardened with Pausable + setValidatorSet + dailyCap)
- **Owner / deployer**: `0x10ed4F004Fe708014ae27Bcc20c9Ed9df3f4eadF` (single EOA — gating on Gnosis Safe migration before mainnet dest-chain deploys, see threat-model §5 L1)
- **Validators (May-19 KMS migration)**: 7 KMS keys in `us-east-1`, aliases `alias/litho-multx-validator-{0..6}`. Full ARN list in [`../../contracts/deployments/kamet-validators-latest.json`](../../contracts/deployments/kamet-validators-latest.json).
- **Bridge-api host (current, verified 2026-06-10)**: **vps2 `187.124.133.209`**, `/opt/bridge`, Docker container `bridge-api` published `0.0.0.0:4001 → 4000` (+ `bridge-postgres` on `127.0.0.1:5433`). SSH key `~/.ssh/id_ed25519` as `root`. *(The earlier AWS indexer `10.0.10.16:4001` location is superseded — bridge stack migrated to vps2; §6.3's RPC-failover edit path is likewise now on vps2.)*
- **Public edge**: `bridge.litho.ai` → Cloudflare (orange, Full SSL) → vps2 nginx vhost `/etc/nginx/sites-available/bridge.conf` (`:80` + `:443`, the `:443` block added 2026-06-10 — see §6.4) → `127.0.0.1:4001`.
- **IAM role** for validator service: `litho-mainnet-indexer-role`, inline policy `MultXValidatorKMSSigning`.

---

*End of runbook. For KMS-specific procedures, continue to [`VALIDATOR_KEY_ROTATION.md`](./VALIDATOR_KEY_ROTATION.md).*

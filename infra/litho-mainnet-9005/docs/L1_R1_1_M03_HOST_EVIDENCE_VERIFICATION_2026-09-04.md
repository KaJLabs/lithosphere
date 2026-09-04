# LITHO L1 R1.1 M03 host-evidence verification

Date: 2026-09-04 UTC

This is a secret-free public summary. The raw administrator evidence remains
in the approved secure evidence channel and is identified only by digest.

## Supplied evidence

- Archive: `l1-m03-host-evidence.tar.gz`
- Archive SHA-256:
  `f68992d32b46bef71690e273958c8912c93fd674d0dd7da906b305534b5f7b31`
- Collection timestamp: `2026-09-03T19:17:02Z`
- Host role: Makalu validator `lithod-mtest-val-02` / `srv02`

## Independent verification

- Every entry in the archive's internal `SHA256SUMS.txt` validated.
- The resolved running executable was `/usr/local/bin/lithod-l1-v20.0.0-r1`.
- Running binary SHA-256 matched the approved R1 identity:
  `1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc`.
- The service was active and running with the expected security-candidate
  drop-in.
- Local CometBFT status reported `lithosphere_700777-2`, moniker
  `mtest-val-02`, `catching_up=false`, and continued block progression.
- The bonded validator identity and voting power matched the retained
  regression record.
- No credential, environment file, SSH material, mnemonic, or private key was
  present in the supplied archive.

## Snapshot limitation

The provider snapshot was confirmed during the controlled window and was
configured to expire on `2026-09-02`. It expired automatically and is no
longer restorable. A screenshot confirming its creation time, expiry and
restore estimate is retained in the secure evidence supplement. No replacement
snapshot evidence was recreated or backdated.

## Scope

This verification closes an evidence-collection input only. It does not
authorize a deployment, restart, transaction, Kamet rollout, or mainnet
rollout. Autha retains authority over the final M03 disposition.

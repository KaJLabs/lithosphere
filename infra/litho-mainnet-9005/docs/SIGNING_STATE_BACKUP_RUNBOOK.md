# Current validator signing-state backup

Status: **prepared, not activated**

The launch-time height-0 identity package is not a current signing-state
backup. This control captures the validator consensus key together with its
current `priv_validator_state.json`, encrypts the stream before persistence,
and stores only ciphertext plus a non-secret manifest in GitHub Actions.

## One-time offline recipient ceremony

Run this on an offline client-controlled device with PyNaCl installed:

```text
python signing_state_backup.py generate-recipient \
  --recovery-key LITHO-current-state-recovery.json \
  --recipient LITHO-current-state-recipient.json
```

Keep the recovery-key file in two separately controlled encrypted offline
locations. Put only the public recipient record in the repository environment
secret `BACKUP_RECIPIENT`. Never upload the recovery key.

## Restricted export identity

Generate a dedicated SSH key for the backup runner and deploy only its public
key through `mainnet-9005-deploy-backup-export.yml`. The account is locked to a
root-owned forced command and can only stream the two required files while
running the exporter as the `litho` service user. It has no PTY, forwarding, or
general sudo access.

Configure the protected GitHub environment `litho-mainnet-backup`:

- `BACKUP_SSH_KEY`: dedicated export-only private key;
- `BACKUP_KNOWN_HOSTS`: independently pinned validator SSH host-key record;
- `BACKUP_RECIPIENT`: public recipient JSON; and
- optional variables `BACKUP_HOST` and `BACKUP_SSH_USER`.

The scheduled workflow runs every six hours and retains encrypted artifacts for
30 days. Successful job execution alone does not close the gate.

## Restore drill and real recovery

For the acceptance drill, download one ciphertext and manifest to an isolated,
offline machine. Run `signing_state_backup.py verify` with the offline recovery
key. Confirm the consensus public key, captured height, checksums and JSON, but
do not install the files and do not start `lithod`.

For a real recovery, stop and isolate the original signer first. A restored
state can double-sign if it is stale while another copy of the consensus key is
active. Prove single-writer ownership and that the restored signing height is
authoritative before installing the key/state pair. If either fact is
uncertain, do not start the validator.

Closure requires a successful scheduled backup, two offline recovery-key
custodians, documented retention, and an isolated verification drill. Evidence
must record hashes and heights only—never key material.

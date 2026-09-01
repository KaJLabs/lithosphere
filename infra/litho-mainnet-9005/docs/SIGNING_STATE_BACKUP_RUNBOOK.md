# Current validator signing-state backup

Status: **dual-recipient migration prepared; activation requires the two public
recipient records and a successful scheduled verification run**

The launch-time height-0 identity package is not a current signing-state
backup. This control captures the validator consensus key together with its
current `priv_validator_state.json`, encrypts the stream before persistence,
and stores only ciphertext plus a non-secret manifest in GitHub Actions.

## One-time offline recipient ceremonies

Each of two independent custodians runs this separately on an offline,
client-controlled device with PyNaCl installed. Custodians must not exchange
their recovery-key files:

```text
python signing_state_backup.py generate-recipient \
  --recovery-key LITHO-current-state-recovery-primary.json \
  --recipient LITHO-current-state-recipient-primary.json

python signing_state_backup.py generate-recipient \
  --recovery-key LITHO-current-state-recovery-backup.json \
  --recipient LITHO-current-state-recipient-backup.json
```

Each custodian retains only their own recovery-key file in separately
controlled encrypted offline storage. Put only the two public recipient
records in the repository environment secrets `BACKUP_RECIPIENT_PRIMARY` and
`BACKUP_RECIPIENT_BACKUP`. Never upload either recovery key.

The workflow encrypts the same validated in-memory archive independently for
both public keys. It uploads two ciphertexts and one non-secret manifest. This
provides independent recovery and independent key rotation; it is not a 2-of-2
threshold scheme, so either approved custodian can recover their ciphertext.

## Restricted export identity

Generate a dedicated SSH key for the backup runner and deploy only its public
key through `mainnet-9005-deploy-backup-export.yml`. The account is locked to a
root-owned forced command and can only stream the two required files while
running the exporter as the `litho` service user. It has no PTY, forwarding, or
general sudo access.

Configure the protected GitHub environment `litho-mainnet-backup`:

- `BACKUP_SSH_KEY`: dedicated export-only private key;
- `BACKUP_KNOWN_HOSTS`: independently pinned validator SSH host-key record;
- `BACKUP_RECIPIENT_PRIMARY`: first custodian's public recipient JSON;
- `BACKUP_RECIPIENT_BACKUP`: second custodian's independently generated public
  recipient JSON; and
- optional variables `BACKUP_HOST` and `BACKUP_SSH_USER`.

The scheduled workflow runs every six hours and retains encrypted artifacts for
30 days. Successful job execution alone does not close the gate.

## Restore drill and real recovery

For the acceptance drill, download both ciphertexts and the common manifest to
isolated offline machines. Each custodian runs `signing_state_backup.py verify`
against only their ciphertext and recovery key. Confirm that both recoveries
report the same consensus public key and captured height, but do not install
the files and do not start `lithod`.

The verifier remains compatible with earlier V1 single-recipient artifacts.
Retain the previous recovery key under its existing custody policy until every
V1 artifact has expired under the 30-day retention policy.

For a real recovery, stop and isolate the original signer first. A restored
state can double-sign if it is stale while another copy of the consensus key is
active. Prove single-writer ownership and that the restored signing height is
authoritative before installing the key/state pair. If either fact is
uncertain, do not start the validator.

Closure requires a successful scheduled backup, two independently generated
recovery keys under separate custodians, documented retention, and successful
isolated verification of both ciphertexts. Evidence must record hashes,
recipient public-key fingerprints, chain ID, capture time and height only—never
private-key material.

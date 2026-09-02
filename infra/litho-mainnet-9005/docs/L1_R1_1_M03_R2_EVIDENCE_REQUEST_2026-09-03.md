# LITHO L1 R1.1 M03 R2 evidence request

This is the narrow evidence checklist for closing `AUTHA-L1-R1-M03`. It does
not authorize a deployment, restart, or transaction.

## Already independently retrievable

- all setup and authoritative exploit transaction objects;
- all transaction receipts and containing block headers;
- harness runtime bytecode at
  `0x1Dc5cbc1cf1E21937D0E12c002A11AA5C154362F`;
- EVM chain identity and current public Cosmos/CometBFT health;
- current supply, staking pool, and bonded-validator responses.

Historical Cosmos application state at heights `13498831` and `13498855` is
pruned from the public REST node. The original point-in-time outputs therefore
must be supplied from retained execution evidence; they must not be recreated
or represented as newly queried historical responses.

## Administrator evidence still required

An authorized Makalu administrator must execute the secret-free read-only
collector supplied with the R2 package and return its output. It must capture:

- on-host SHA-256 of the service's resolved executable;
- systemd unit/drop-in and active service metadata without environment values;
- current node status, validator status, peer count, and recent relevant logs;
- proof of the candidate activation/rollback file identities; and
- the provider snapshot confirmation artifact, if retained.

Do not include environment files, SSH material, validator keys, mnemonics,
private endpoints, provider credentials, or unredacted process environments.

After obtaining the reviewed collector from the merged default branch, run:

```bash
sudo bash collect_l1_m03_host_evidence.sh \
  lithod-mtest-val-02 http://127.0.0.1:26757 \
  l1-m03-host-evidence
```

Verify `l1-m03-host-evidence/SHA256SUMS.txt` locally and transfer the directory
through the approved evidence channel. The collector performs only read-only
file hashing, systemd metadata queries, local RPC queries, and journal reads.

## Governance evidence still required

- KaJ Labs acceptance of
  `L1_R1_1_M03_PROCESS_EXCEPTION_2026-09-03.md` without backdating;
- the independent observer's signed or durable attestation of the evidence
  they actually checked; and
- a detached signature by the KaJ Labs organizational release key over the
  final evidence checksum manifest.

When complete, Autha should be asked only to close M03 as a documented process
exception with corrective controls. No L1 implementation re-audit is required
unless the executable changes.

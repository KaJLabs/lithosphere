# LITHO L1 R1.1 M03 observer attestation

- Observer: BrewCodeDev, independent evidence reviewer
- Durable identity: `@BrewCodeDev`
- Evidence payload SHA-256:
  `400beb8d088861a37a3f79615f4d32fab19cd77d4ba358943a48ee89d1ea7aa0`
- Verification timestamp: `2026-09-04T00:20:05Z`

I independently confirmed:

- candidate release `litho-l1-v20.0.0-r1` and binary SHA-256
  `1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc`;
- the test network was Makalu, Cosmos `lithosphere_700777-2`, EVM
  `700777`;
- retained snapshot-confirmation and rollback evidence was present for the
  controlled window;
- all four authoritative exploit transactions have receipt status `0x0`;
- the ordinary EOA control has receipt status `0x1`;
- the harness runtime Keccak-256 is
  `0xdd6fad5fced8d7484cd7902fd6731b8255c7fc7bca2a954faf22a3c01c2957e1`;
- retained point-in-time evidence supports unchanged balances, delegation and
  total supply;
- blocks resumed, the validator remained active, and `catching_up=false`;
- every checksum in the supplied host archive and final payload manifest
  validated.

## Limitations and exceptions

- The provider snapshot expired automatically on `2026-09-02` and is no
  longer restorable. The payload contains the retained provider screenshot,
  not a newly generated snapshot artifact.
- Historical application state is pruned and cannot be freshly re-queried.
  The point-in-time statements above are limited to the retained, hashed raw
  responses.
- The administrator executed the on-host collector. The observer verified its
  archive digest, internal manifest, running-binary identity and reported
  health evidence, but did not receive administrator credentials or private
  keys.

I attest that these statements reflect my independent review of the evidence
payload identified above. I received no validator, account, SSH, recovery or
other private key.

Durable signature/reference: the BrewCodeDev-authored commit and reviewed KaJ
Labs pull request containing this attestation. The separate KaJ Labs
organizational detached signature over the final handoff manifest remains
required.

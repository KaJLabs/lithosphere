# LITHO L1 R1.1 M03 Observer Attestation

Status: **completed - independent observer attestation**

- Observer name and organizational role: `Amir Aziz — Independent Observer`
- GitHub username / durable identity: `amirmughal22`
- Final signed package SHA-256: `2c91fc95035c1821531e79e24d5866edbeb1d2377b0629a3a7c429b48a326859`
- Evidence payload SHA-256: `400beb8d088861a37a3f79615f4d32fab19cd77d4ba358943a48ee89d1ea7aa0`
- Independent verification timestamp (UTC): `2026-09-06T19:20:07Z`

## Independent review

I independently reviewed the supplied signed M03 evidence package using only the retained evidence contained in the package.

No server access, administrator credentials, validator keys, account keys, SSH keys, recovery keys, or other private credentials were requested, received, or used during this review.

I independently confirmed:

- [x] Candidate release `litho-l1-v20.0.0-r1`.
- [x] Candidate binary SHA-256:
  `1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc`.
- [x] The controlled test network was Makalu:
  - Cosmos chain ID: `lithosphere_700777-2`
  - EVM chain ID: `700777`
- [x] Retained provider snapshot-confirmation evidence and rollback-file identity were present for the controlled test window.
- [x] All four authoritative exploit transactions have receipt status `0x0`.
- [x] The ordinary EOA control transaction has receipt status `0x1`.
- [x] The supplied harness runtime is 5,520 bytes and independently hashes to Keccak-256:
  `0xdd6fad5fced8d7484cd7902fd6731b8255c7fc7bca2a954faf22a3c01c2957e1`.
- [ ] Unchanged balances, delegation, and total supply are **not independently attested from this package** because the historical baseline/final application-state queries are pruned and separate raw retained baseline/final application-state responses were not present in the signed evidence package.
- [x] Later retained public and host evidence shows continued block progression.
- [x] The validator service remained active.
- [x] Reported validator voting power was `50000000`.
- [x] Reported node synchronization status was `catching_up=false`.
- [x] Every checksum in the supplied host archive validated.
- [x] Every checksum in the R3 evidence payload validated.
- [x] Every checksum in the final handoff manifest validated.
- [x] The detached KaJ Labs organizational signature over the final handoff manifest verified successfully under:
  - Primary fingerprint: `073B 5DB3 50EF 4BEB D939 F243 1032 6AAA 1839 EAEB`
  - Signing subkey: `7138 DEE3 D051 92AB 157C 7E8C 3B3A 6159 F3A5 EEDE`

## Limitations and exceptions

- The provider snapshot expired automatically on `2026-09-02` and is no longer restorable. The retained evidence establishes historical snapshot presence, creation time, expiry information, and the recorded restore estimate only.
- Historical application state at the relevant baseline and final heights is pruned from the currently retained public-query evidence.
- The execution narrative reports unchanged supply, bonded pool, delegation, and harness balance; however, the corresponding original raw point-in-time baseline/final application-state responses were not retained in the signed package. I therefore do not independently attest to that protected-state invariant.
- The supplied package contains a prior attestation identifying `BrewCodeDev` as independent observer, while the supplied preflight evidence identifies `BrewCodeDev` as the execution operator. That prior attestation should therefore not be relied upon to establish observer independence.
- This attestation is instead completed by `Amir Aziz` (`@amirmughal22`) as the independent observer.
- The administrator performed the on-host evidence collection. My review was limited to the supplied signed evidence package and did not involve privileged access to the host.

## Attestation statement

I, Amir Aziz (`@amirmughal22`), attest that the checked statements above accurately reflect my independent review of the signed M03 evidence package identified by the hashes above.

I received no validator key, account key, SSH key, recovery key, administrator credential, or other private credential as part of this review.

I have intentionally not attested to the unchecked balances/delegation/total-supply invariant because sufficient raw retained point-in-time application-state evidence was not available in the signed package to independently verify that claim.

This attestation is limited to independent review of the supplied M03 evidence package. It does not constitute network activation approval, mainnet approval, or authorization for any subsequent phase.

## Durable signature / review reference

GitHub identity: `@amirmughal22`

Durable review reference: `GitHub pull request containing this attestation, authored by @amirmughal22`

Final PR reference: `KaJLabs/Lithosphere#166`

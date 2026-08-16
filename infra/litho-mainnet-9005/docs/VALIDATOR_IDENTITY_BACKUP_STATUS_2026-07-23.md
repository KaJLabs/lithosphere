# Validator Identity Backup Status

Date: 2026-07-23

## Completed

- Verified the validator consensus key, node identity, and initial signing
  state exist on the validator with mode `0600`.
- Streamed the three files through authenticated SSH and encrypted them in
  memory using an X25519/XSalsa20-Poly1305 sealed box.
- Wrote no plaintext validator key files to the operator workstation.
- Successfully test-decrypted the recovery package in memory.
- Confirmed the consensus public key matches the final genesis.
- Confirmed the initial signing state is height `0`.
- Restricted the local recovery-key file ACL to the operator account,
  Administrators, and SYSTEM.

Encrypted backup SHA-256:
`fc605b1fb0bd2645e601845f295efd33f08e66289319cd5bbf1105da7cb467bd`

The encrypted archive, recovery key, and manifest are intentionally stored
outside the repository under the operator's temporary recovery location.

On 2026-07-24, the encrypted archive, manifest, and recovery key were copied to
`E:\\LITHO-mainnet-recovery-2026-07-24` and verified byte-for-byte. The client
confirmed BitLocker status as 100% encrypted with protection on. The complete
package was decrypted and validated from the USB copy; the consensus key
matched genesis and the initial signing state was height `0`.

The client subsequently confirmed that a second encrypted copy was stored
separately.

## Launch handling

The offline backup requirement is client-confirmed complete. Keep both copies
offline and remove the temporary workstation recovery-key copy after confirming
that the second copy remains recoverable.

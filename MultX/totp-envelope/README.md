# Optional MultX TOTP envelope service

This isolated service decrypts a KMS-encrypted TOTP seed only in memory and
returns the current short-lived code over TLS 1.3 after bearer authentication.
It never exposes the seed and has no signing permission. Keep it disabled
unless an approved MultX workflow actually requires TOTP.

The runtime needs only `kms:Decrypt` on its dedicated symmetric KMS key. The
one-time `scripts/encrypt-envelope.js` ceremony uses a separate operator role
with only `kms:Encrypt`. Both operations require the fixed, non-secret
encryption context in the deployment package.

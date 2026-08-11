import fs from 'fs';
import { EncryptCommand, KMSClient } from '@aws-sdk/client-kms';

const seedFile = process.env.TOTP_SEED_FILE;
const outputFile = process.env.TOTP_ENVELOPE_OUTPUT;
const keyId = process.env.TOTP_KMS_KEY_ID;
const region = process.env.AWS_REGION;
if (!seedFile || !outputFile || !keyId || !region) throw new Error('TOTP_SEED_FILE, TOTP_ENVELOPE_OUTPUT, TOTP_KMS_KEY_ID and AWS_REGION are required');
const seed = fs.readFileSync(seedFile, 'utf8').trim();
const result = await new KMSClient({ region }).send(new EncryptCommand({
  KeyId: keyId,
  Plaintext: Buffer.from(seed),
  EncryptionContext: { service: 'multx-totp-envelope', purpose: 'operator-step-up' },
}));
if (!result.CiphertextBlob) throw new Error('KMS Encrypt returned no ciphertext');
fs.writeFileSync(outputFile, `${JSON.stringify({ version: 1, ciphertext: Buffer.from(result.CiphertextBlob).toString('base64') }, null, 2)}\n`, { mode: 0o600 });
console.log(`Encrypted TOTP envelope written to ${outputFile}`);

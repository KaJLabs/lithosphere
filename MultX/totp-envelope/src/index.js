import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import { DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { currentTotp } from './totp.js';

const requiredFile = (name) => {
  const filename = process.env[name];
  if (!filename) throw new Error(`${name} is required`);
  const value = fs.readFileSync(filename);
  if (!value.length) throw new Error(`${name} is empty`);
  return value;
};
const authorised = (header, token) => {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};
const send = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'cache-control': 'no-store' });
  res.end(payload);
};

const region = process.env.AWS_REGION;
const keyId = process.env.TOTP_KMS_KEY_ID;
if (!region || !keyId) throw new Error('AWS_REGION and TOTP_KMS_KEY_ID are required');
const token = requiredFile('TOTP_BEARER_TOKEN_FILE').toString('utf8').trim();
if (token.length < 32) throw new Error('TOTP bearer token must contain at least 32 characters');
const kms = new KMSClient({ region }); // Standard AWS temporary-credential chain.
const context = { service: 'multx-totp-envelope', purpose: 'operator-step-up' };

const server = https.createServer({
  cert: requiredFile('TOTP_TLS_CERT_FILE'),
  key: requiredFile('TOTP_TLS_KEY_FILE'),
  minVersion: 'TLSv1.3',
}, async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'healthy' });
    if (!authorised(req.headers.authorization, token)) return send(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST' || req.url !== '/v1/code') return send(res, 404, { error: 'not_found' });
    const envelope = JSON.parse(requiredFile('TOTP_ENVELOPE_FILE').toString('utf8'));
    if (envelope.version !== 1 || typeof envelope.ciphertext !== 'string') throw new Error('invalid TOTP envelope');
    const result = await kms.send(new DecryptCommand({
      KeyId: keyId,
      CiphertextBlob: Buffer.from(envelope.ciphertext, 'base64'),
      EncryptionContext: context,
    }));
    if (!result.Plaintext) throw new Error('KMS Decrypt returned no plaintext');
    const seed = Buffer.from(result.Plaintext).toString('utf8').trim();
    const response = currentTotp(seed);
    return send(res, 200, response);
  } catch (error) {
    console.error(`[totp-envelope] request rejected: ${error.message}`);
    return send(res, 400, { error: 'request_rejected' });
  }
});

const port = Number(process.env.TOTP_PORT || 9444);
server.listen(port, '0.0.0.0', () => console.log(`[totp-envelope] listening on ${port}`));

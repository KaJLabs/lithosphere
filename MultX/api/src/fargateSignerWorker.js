import { createServer } from 'node:http';
import { getBytes, verifyMessage } from 'ethers';
import { kmsKeyAddress, kmsSignMessage } from './services/kmsSigner.js';

if (process.env.SIGNER_VERIFY_ONLY !== 'true' || process.env.VALIDATOR_SIGNING_ENABLED !== 'false') {
  throw new Error('Fargate verification image refuses to start outside transaction-free verification mode');
}

const keyId = process.env.VALIDATOR_KMS_KEY_ARN;
if (!keyId) throw new Error('VALIDATOR_KMS_KEY_ARN is required');

const address = await kmsKeyAddress(keyId);
const expected = process.env.EXPECTED_SIGNER_ADDRESS;
if (expected && expected.toLowerCase() !== address.toLowerCase()) {
  throw new Error(`KMS signer ${address} does not match EXPECTED_SIGNER_ADDRESS`);
}

const challenge = getBytes(Buffer.from('MultX Fargate signer transaction-free verification v1'));
const signature = await kmsSignMessage({ keyId, message: challenge, expectedAddress: address });
const recovered = verifyMessage(challenge, signature);
if (recovered.toLowerCase() !== address.toLowerCase()) {
  throw new Error(`verification recovered ${recovered}, expected ${address}`);
}

console.log(`[FargateSigner] Transaction-free KMS verification passed for ${address}`);

const server = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/health') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ status: 'ok', mode: 'verification-only', address }));
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(8080, '127.0.0.1', resolve);
});
console.log('[FargateSigner] Verification-only mode ready; transactions and database access are disabled');

const shutdown = (signal) => {
  console.log(`[FargateSigner] ${signal} received; shutting down`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

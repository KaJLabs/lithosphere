import fs from 'fs';
import https from 'https';
import path from 'path';
import { ethers } from 'ethers';
import { assertLockEvent, releaseMessageHash, resolvePolicy, validateAttestation } from './policy.js';

const requiredFile = (envName) => {
  const file = process.env[envName];
  if (!file) throw new Error(`${envName} is required`);
  const value = fs.readFileSync(file);
  if (value.length === 0) throw new Error(`${envName} is empty`);
  return value;
};

const policy = JSON.parse(requiredFile('SIGNER_POLICY_FILE').toString('utf8'));
const privateKey = requiredFile('SIGNER_PRIVATE_KEY_FILE').toString('utf8').trim();
const wallet = new ethers.Wallet(privateKey);
if (policy.signerAddress && ethers.utils.getAddress(policy.signerAddress) !== wallet.address) {
  throw new Error(`policy signer ${policy.signerAddress} does not match key ${wallet.address}`);
}

const providers = new Map();
const sourceContract = (source) => {
  const key = Number(source.chainId);
  if (!providers.has(key)) {
    const provider = new ethers.providers.StaticJsonRpcProvider(source.rpcUrl, key);
    const contract = new ethers.Contract(source.bridgeAddress, [
      'event TokensLocked(bytes32 indexed txHash,address indexed token,address indexed user,uint256 amount,uint256 targetChain,uint256 nonce)',
    ], provider);
    providers.set(key, { provider, contract });
  }
  return providers.get(key);
};

const stateFile = process.env.SIGNER_STATE_FILE || '/var/lib/multx-signer/signed-releases.jsonl';
fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
const signed = new Map();
if (fs.existsSync(stateFile)) {
  for (const line of fs.readFileSync(stateFile, 'utf8').split('\n').filter(Boolean)) {
    const record = JSON.parse(line);
    const prior = signed.get(record.key);
    if (prior && prior !== record.hash) throw new Error(`equivocation detected in state for ${record.key}`);
    signed.set(record.key, record.hash);
  }
}

const persistDecision = (key, hash) => {
  const fd = fs.openSync(stateFile, 'a', 0o600);
  try {
    fs.writeSync(fd, `${JSON.stringify({ key, hash, at: new Date().toISOString() })}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  signed.set(key, hash);
};

let signingQueue = Promise.resolve();
const serializeSigning = (fn) => {
  const run = signingQueue.then(fn, fn);
  signingQueue = run.catch(() => {});
  return run;
};

const verifyAndSign = async (input) => {
  const attestation = validateAttestation(input);
  const { source } = resolvePolicy(policy, attestation);
  const { provider, contract } = sourceContract(source);

  const network = await provider.getNetwork();
  if (Number(network.chainId) !== attestation.sourceChain) throw new Error('source RPC chain ID mismatch');
  const tip = await provider.getBlockNumber();
  const confirmations = tip - attestation.sourceBlock + 1;
  if (confirmations < Number(source.confirmations || 1)) {
    throw new Error(`source lock has ${confirmations} confirmations`);
  }

  const events = await contract.queryFilter(
    contract.filters.TokensLocked(attestation.sourceTxHash),
    attestation.sourceBlock,
    attestation.sourceBlock,
  );
  const event = events.find((candidate) => {
    try { assertLockEvent(candidate, attestation); return true; } catch { return false; }
  });
  assertLockEvent(event, attestation);

  const hash = releaseMessageHash(attestation);
  const key = `${attestation.sourceChain}:${attestation.sourceNonce}`;
  return serializeSigning(async () => {
    const prior = signed.get(key);
    if (prior && prior !== hash) throw new Error(`refusing equivocation for ${key}`);
    const signature = await wallet.signMessage(ethers.utils.arrayify(hash));
    if (!prior) persistDecision(key, hash);
    return signature;
  });
};

const readJson = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let total = 0;
  req.on('data', (chunk) => {
    total += chunk.length;
    if (total > 32 * 1024) {
      reject(new Error('request body exceeds 32 KiB'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { reject(new Error('invalid JSON')); }
  });
  req.on('error', reject);
});

const send = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
};

const server = https.createServer({
  cert: requiredFile('SIGNER_TLS_CERT_FILE'),
  key: requiredFile('SIGNER_TLS_KEY_FILE'),
  ca: requiredFile('SIGNER_CLIENT_CA_FILE'),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.3',
}, async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { status: 'healthy' });
    if (req.method === 'GET' && req.url === '/v1/identity') return send(res, 200, { address: wallet.address });
    if (req.method === 'POST' && req.url === '/v1/sign-release') {
      const signature = await verifyAndSign(await readJson(req));
      return send(res, 200, { address: wallet.address, signature });
    }
    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error(`[signer] request rejected: ${err.message}`);
    return send(res, 400, { error: 'request_rejected' });
  }
});

const port = Number(process.env.SIGNER_PORT || 9443);
server.listen(port, '0.0.0.0', () => {
  console.log(`[signer] listening on ${port}; address=${wallet.address}`);
});

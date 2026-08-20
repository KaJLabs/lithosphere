import fs from 'fs';
import https from 'https';
import { ethers } from 'ethers';

const MAX_RESPONSE_BYTES = 64 * 1024;

const requiredFile = (path, label) => {
  if (!path) throw new Error(`${label} is required`);
  const value = fs.readFileSync(path);
  if (value.length === 0) throw new Error(`${label} is empty`);
  return value;
};

const bearerToken = (path, label) => {
  const token = requiredFile(path, label).toString('utf8').trim();
  if (token.length < 32 || token.length > 512 || /[\r\n]/.test(token)) {
    throw new Error(`${label} must contain 32 to 512 characters`);
  }
  return token;
};

export const resolveRemoteSignerAuth = ({ index, caFile, certFile, keyFile, tokenFile }) => {
  if (tokenFile) {
    if (certFile || keyFile) throw new Error(`remote signer ${index} must use bearer or mTLS client credentials, not both`);
    return {
      mode: 'bearer',
      token: bearerToken(tokenFile, `VALIDATOR_SIGNER_TOKEN_FILE_${index}`),
      tls: { ...(caFile ? { ca: requiredFile(caFile, `VALIDATOR_SIGNER_CA_FILE_${index}`) } : {}) },
    };
  }
  return {
    mode: 'mtls',
    token: null,
    tls: {
      ca: requiredFile(caFile, `VALIDATOR_SIGNER_CA_FILE_${index}`),
      cert: requiredFile(certFile, `VALIDATOR_SIGNER_CERT_FILE_${index}`),
      key: requiredFile(keyFile, `VALIDATOR_SIGNER_KEY_FILE_${index}`),
    },
  };
};

export const validateSignerUrl = (value) => {
  let url;
  try { url = new URL(value); } catch { throw new Error('remote signer URL must be valid'); }
  if (url.protocol !== 'https:') throw new Error('remote signer URL must use https');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('remote signer URL must not contain credentials, query parameters, or a fragment');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('remote signer URL must be an origin without a path');
  }
  return url.origin;
};

const requestJson = ({ baseUrl, path, method, body, tls, token, timeoutMs }) => new Promise((resolve, reject) => {
  const url = new URL(path, baseUrl);
  if (url.protocol !== 'https:') {
    reject(new Error(`remote signer URL must use https (got ${url.protocol})`));
    return;
  }

  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const req = https.request({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || 443,
    path: `${url.pathname}${url.search}`,
    method,
    ca: tls.ca,
    cert: tls.cert,
    key: tls.key,
    rejectUnauthorized: true,
    servername: url.hostname,
    timeout: timeoutMs,
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': String(payload.length),
      } : {}),
    },
  }, (res) => {
    const chunks = [];
    let total = 0;
    res.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_RESPONSE_BYTES) {
        req.destroy(new Error('remote signer response exceeds 64 KiB'));
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`remote signer returned HTTP ${res.statusCode || 0}`));
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('remote signer returned invalid JSON'));
      }
    });
  });

  req.on('timeout', () => req.destroy(new Error(`remote signer timed out after ${timeoutMs}ms`)));
  req.on('error', reject);
  if (payload) req.write(payload);
  req.end();
});

export const releaseMessageHash = (attestation) => ethers.solidityPackedKeccak256(
  ['bytes32', 'address', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
  [
    attestation.sourceTxHash,
    attestation.sourceBridge,
    attestation.releaseToken,
    attestation.user,
    attestation.amount,
    attestation.sourceChain,
    attestation.sourceNonce,
    attestation.targetChain,
    attestation.releaseBridge,
  ],
);

export const verifyReleaseSignature = ({ attestation, signature, expectedAddress }) => {
  const hash = releaseMessageHash(attestation);
  const recovered = ethers.verifyMessage(ethers.getBytes(hash), signature);
  if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(`signature recovered ${recovered}, expected ${expectedAddress}`);
  }
  return signature;
};

export const createRemoteSigner = async ({
  index,
  url,
  expectedAddress,
  caFile,
  certFile,
  keyFile,
  tokenFile,
  timeoutMs = 8_000,
}) => {
  const address = ethers.getAddress(expectedAddress);
  const baseUrl = validateSignerUrl(url);
  const auth = resolveRemoteSignerAuth({ index, caFile, certFile, keyFile, tokenFile });

  const identity = await requestJson({
    baseUrl,
    path: '/v1/identity',
    method: 'GET',
    tls: auth.tls,
    token: auth.token,
    timeoutMs,
  });
  const reported = ethers.getAddress(identity.address || '');
  if (reported !== address) {
    throw new Error(`remote signer ${index} reports ${reported}, expected ${address}`);
  }

  return {
    index,
    kind: 'remote',
    address,
    async signRelease(attestation) {
      const response = await requestJson({
        baseUrl,
        path: '/v1/sign-release',
        method: 'POST',
        body: { version: 1, ...attestation },
        tls: auth.tls,
        token: auth.token,
        timeoutMs,
      });
      if (typeof response.signature !== 'string') {
        throw new Error(`remote signer ${index} returned no signature`);
      }
      return verifyReleaseSignature({ attestation, signature: response.signature, expectedAddress: address });
    },
  };
};

import { KMSClient, SignCommand, GetPublicKeyCommand } from '@aws-sdk/client-kms';
import asn1 from 'asn1.js';
import { ethers } from 'ethers';
import BN from 'bn.js';

// AWS KMS returns ECDSA signatures as DER-encoded ASN.1 SEQUENCE { r, s }.
// Ethereum needs raw (r, s, v) where v is the recovery byte (27 or 28).
// AWS KMS also doesn't apply the EthSignedMessage prefix or know about
// recovery — we compute the prefixed hash ourselves and try both recovery
// values to find the one matching the validator's known address.

const EcdsaSigAsn = asn1.define('EcdsaSig', function () {
  this.seq().obj(
    this.key('r').int(),
    this.key('s').int(),
  );
});

// secp256k1 curve order n; needed for low-s normalization.
const SECP256K1_N = new BN(
  'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
  16
);
const HALF_N = SECP256K1_N.shrn(1);

const clientCache = new Map();
const kmsClient = (region) => {
  const r = region || process.env.AWS_REGION || 'us-east-1';
  if (!clientCache.has(r)) clientCache.set(r, new KMSClient({ region: r }));
  return clientCache.get(r);
};

/**
 * Resolve a KMS key's Ethereum address from its public key.
 * KMS returns DER-encoded SubjectPublicKeyInfo; the last 65 bytes are the
 * uncompressed point (0x04 || X || Y). Eth address = last 20 bytes of
 * keccak256(X || Y).
 */
export const kmsKeyAddress = async (keyId, region) => {
  const client = kmsClient(region);
  const res = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (!res.PublicKey) throw new Error(`KMS GetPublicKey returned no PublicKey for ${keyId}`);
  const der = Buffer.from(res.PublicKey);
  // Find the uncompressed point. ECC_SECG_P256K1 SPKI is 88 bytes; the trailing 65 are 0x04||X||Y.
  const point = der.slice(der.length - 65);
  if (point[0] !== 0x04) {
    throw new Error(`KMS key ${keyId} did not return an uncompressed point (got 0x${point[0].toString(16)})`);
  }
  const xy = point.slice(1); // 64 bytes
  const hash = ethers.utils.keccak256(xy);
  return ethers.utils.getAddress('0x' + hash.slice(-40));
};

/**
 * Sign a 32-byte message digest with a KMS-held secp256k1 key, returning a
 * 65-byte Ethereum signature (r || s || v) compatible with ecrecover.
 *
 * `digest` may be either:
 *   - a 32-byte digest (Uint8Array | Buffer | 0x-hex string) — signed directly
 *   - a `{ messageBytes }` object — hashed with the Ethereum Signed Message
 *     prefix before signing (matches ethers.Wallet.signMessage behavior)
 *
 * The expected validator address is needed to compute the recovery byte —
 * we try both v=27 and v=28 and return the one whose ecrecover matches.
 */
export const kmsSignDigest = async ({ keyId, digestHex, expectedAddress, region }) => {
  if (!digestHex || !/^0x[0-9a-fA-F]{64}$/.test(digestHex)) {
    throw new Error(`kmsSignDigest: digestHex must be a 32-byte 0x-hex string (got ${digestHex})`);
  }
  const client = kmsClient(region);

  const digest = Buffer.from(digestHex.slice(2), 'hex');
  const res = await client.send(new SignCommand({
    KeyId: keyId,
    Message: digest,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }));
  if (!res.Signature) throw new Error(`KMS Sign returned no Signature for ${keyId}`);

  // Decode DER → { r, s }
  let { r, s } = EcdsaSigAsn.decode(Buffer.from(res.Signature), 'der');
  // Normalize to low-s (Eth requires s in [1, n/2])
  if (s.cmp(HALF_N) > 0) s = SECP256K1_N.sub(s);

  const rHex = r.toArrayLike(Buffer, 'be', 32).toString('hex');
  const sHex = s.toArrayLike(Buffer, 'be', 32).toString('hex');

  // Try both recovery bytes; return the one whose recovered address matches expectedAddress.
  for (const v of [27, 28]) {
    const sig = `0x${rHex}${sHex}${v.toString(16).padStart(2, '0')}`;
    try {
      const recovered = ethers.utils.recoverAddress(digestHex, sig);
      if (recovered.toLowerCase() === expectedAddress.toLowerCase()) {
        return sig;
      }
    } catch {
      // Try the other v
    }
  }
  throw new Error(
    `kmsSignDigest: neither v=27 nor v=28 recovered ${expectedAddress} for key ${keyId}. ` +
    `Check the validator address ↔ KMS key mapping.`
  );
};

/**
 * Convenience: sign a message exactly like ethers.Wallet.signMessage —
 * prepends the Ethereum Signed Message prefix and hashes before sending to KMS.
 */
export const kmsSignEthMessage = async ({ keyId, message, expectedAddress, region }) => {
  // ethers.utils.hashMessage prepends "\x19Ethereum Signed Message:\n<len>" and keccaks.
  const digestHex = ethers.utils.hashMessage(message);
  return kmsSignDigest({ keyId, digestHex, expectedAddress, region });
};

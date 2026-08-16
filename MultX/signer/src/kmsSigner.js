import { GetPublicKeyCommand, KMSClient, SignCommand } from '@aws-sdk/client-kms';
import { getAddress, hashMessage, keccak256, recoverAddress } from 'ethers';

const CURVE_N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const HALF_N = CURVE_N >> 1n;
const clients = new Map();

const clientFor = (region) => {
  const selected = region || process.env.AWS_REGION || 'us-east-1';
  if (!clients.has(selected)) clients.set(selected, new KMSClient({ region: selected }));
  return clients.get(selected);
};

const readDerLength = (bytes, offset) => {
  const first = bytes[offset];
  if (first === undefined) throw new Error('truncated DER length');
  if (first < 0x80) return { length: first, next: offset + 1 };
  const count = first & 0x7f;
  if (count < 1 || count > 2 || offset + count >= bytes.length) {
    throw new Error('unsupported DER length');
  }
  let length = 0;
  for (let i = 0; i < count; i += 1) length = (length << 8) | bytes[offset + 1 + i];
  return { length, next: offset + 1 + count };
};

const decodeInteger = (bytes, offset) => {
  if (bytes[offset] !== 0x02) throw new Error('invalid DER integer');
  const { length, next } = readDerLength(bytes, offset + 1);
  const value = bytes.subarray(next, next + length);
  if (value.length === 0 || next + length > bytes.length) throw new Error('truncated DER integer');
  return { value: BigInt(`0x${Buffer.from(value).toString('hex') || '0'}`), next: next + length };
};

export const decodeKmsSignature = (input) => {
  const bytes = Buffer.from(input);
  if (bytes[0] !== 0x30) throw new Error('invalid DER signature sequence');
  const sequence = readDerLength(bytes, 1);
  if (sequence.next + sequence.length !== bytes.length) throw new Error('invalid DER signature length');
  const r = decodeInteger(bytes, sequence.next);
  const s = decodeInteger(bytes, r.next);
  if (s.next !== bytes.length || r.value < 1n || s.value < 1n) {
    throw new Error('invalid DER signature values');
  }
  return { r: r.value, s: s.value > HALF_N ? CURVE_N - s.value : s.value };
};

const word = (value) => value.toString(16).padStart(64, '0');

export const kmsKeyAddress = async (keyId, { region, client } = {}) => {
  const response = await (client || clientFor(region)).send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (!response.PublicKey) throw new Error('KMS GetPublicKey returned no public key');
  if (response.KeySpec && response.KeySpec !== 'ECC_SECG_P256K1') {
    throw new Error(`KMS key must use ECC_SECG_P256K1, received ${response.KeySpec}`);
  }
  if (response.KeyUsage && response.KeyUsage !== 'SIGN_VERIFY') {
    throw new Error(`KMS key must use SIGN_VERIFY, received ${response.KeyUsage}`);
  }
  if (response.SigningAlgorithms && !response.SigningAlgorithms.includes('ECDSA_SHA_256')) {
    throw new Error('KMS key does not support ECDSA_SHA_256');
  }
  const point = Buffer.from(response.PublicKey).subarray(-65);
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error('KMS key is not an uncompressed secp256k1 key');
  }
  return getAddress(`0x${keccak256(point.subarray(1)).slice(-40)}`);
};

export const kmsSignMessage = async ({ keyId, message, expectedAddress, region, client }) => {
  const digest = hashMessage(message);
  const response = await (client || clientFor(region)).send(new SignCommand({
    KeyId: keyId,
    Message: Buffer.from(digest.slice(2), 'hex'),
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }));
  if (!response.Signature) throw new Error('KMS Sign returned no signature');
  const { r, s } = decodeKmsSignature(response.Signature);
  for (const v of [27, 28]) {
    const signature = `0x${word(r)}${word(s)}${v.toString(16)}`;
    if (recoverAddress(digest, signature).toLowerCase() === expectedAddress.toLowerCase()) {
      return signature;
    }
  }
  throw new Error('KMS signature does not recover the expected signer address');
};

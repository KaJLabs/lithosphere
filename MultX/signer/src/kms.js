import { GetPublicKeyCommand, KMSClient, SignCommand } from '@aws-sdk/client-kms';
import { ethers } from 'ethers';

const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
const HALF_CURVE_ORDER = CURVE_ORDER / 2n;

const readDerLength = (bytes, offset) => {
  const first = bytes[offset];
  if (first < 0x80) return { length: first, next: offset + 1 };
  const octets = first & 0x7f;
  if (octets === 0 || octets > 4) throw new Error('unsupported DER length');
  let length = 0;
  for (let i = 0; i < octets; i += 1) length = (length * 256) + bytes[offset + 1 + i];
  return { length, next: offset + 1 + octets };
};

export const decodeDerSignature = (input) => {
  const bytes = Buffer.from(input);
  let offset = 0;
  if (bytes[offset++] !== 0x30) throw new Error('KMS signature is not a DER sequence');
  const sequence = readDerLength(bytes, offset);
  offset = sequence.next;
  if (offset + sequence.length !== bytes.length) throw new Error('invalid DER sequence length');
  const integers = [];
  for (let i = 0; i < 2; i += 1) {
    if (bytes[offset++] !== 0x02) throw new Error('invalid DER ECDSA integer');
    const item = readDerLength(bytes, offset);
    offset = item.next;
    if (item.length === 0 || offset + item.length > bytes.length) throw new Error('invalid DER integer length');
    let value = bytes.subarray(offset, offset + item.length);
    offset += item.length;
    while (value.length > 1 && value[0] === 0) value = value.subarray(1);
    if (value.length > 32) throw new Error('DER ECDSA integer exceeds 256 bits');
    integers.push(BigInt(`0x${value.toString('hex') || '0'}`));
  }
  if (offset !== bytes.length) throw new Error('unexpected DER signature data');
  return { r: integers[0], s: integers[1] };
};

export const createKmsSigner = async ({ keyId, region, expectedAddress, client }) => {
  if (!keyId || !region || !expectedAddress) throw new Error('KMS_KEY_ID, AWS_REGION and KMS_EXPECTED_ADDRESS are required');
  const kms = client || new KMSClient({ region }); // Uses the standard AWS credential provider chain.
  const approvedAddress = ethers.getAddress(expectedAddress);
  const verifyIdentity = async () => {
    const publicResult = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }));
    if (publicResult.KeySpec !== 'ECC_SECG_P256K1' || publicResult.KeyUsage !== 'SIGN_VERIFY') {
      throw new Error(`KMS key must be ECC_SECG_P256K1/SIGN_VERIFY, got ${publicResult.KeySpec}/${publicResult.KeyUsage}`);
    }
    if (!publicResult.PublicKey) throw new Error('KMS GetPublicKey returned no public key');
    const spki = Buffer.from(publicResult.PublicKey);
    const point = spki.subarray(spki.length - 65);
    if (point.length !== 65 || point[0] !== 0x04) throw new Error('KMS returned an unsupported secp256k1 public key');
    const address = ethers.computeAddress(`0x${point.toString('hex')}`);
    if (approvedAddress !== address) throw new Error(`KMS public key address ${address} does not match expected address`);
    return { address, keySpec: publicResult.KeySpec, keyUsage: publicResult.KeyUsage };
  };
  const identity = await verifyIdentity();

  return {
    address: identity.address,
    verifyIdentity,
    signMessage: async (messageBytes) => {
      const digest = ethers.hashMessage(messageBytes);
      const result = await kms.send(new SignCommand({
        KeyId: keyId,
        Message: Buffer.from(ethers.getBytes(digest)),
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256',
      }));
      if (!result.Signature) throw new Error('KMS Sign returned no signature');
      let { r, s } = decodeDerSignature(result.Signature);
      if (r <= 0n || r >= CURVE_ORDER || s <= 0n || s >= CURVE_ORDER) throw new Error('KMS returned out-of-range ECDSA values');
      if (s > HALF_CURVE_ORDER) s = CURVE_ORDER - s;
      const rHex = ethers.toBeHex(r, 32);
      const sHex = ethers.toBeHex(s, 32);
      for (const v of [27, 28]) {
        const signature = ethers.Signature.from({ r: rHex, s: sHex, v }).serialized;
        if (ethers.recoverAddress(digest, signature) === identity.address) return signature;
      }
      throw new Error('KMS signature does not recover the configured signer address');
    },
  };
};

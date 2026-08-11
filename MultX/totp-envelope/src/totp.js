import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const decodeBase32 = (value) => {
  const clean = value.toUpperCase().replace(/=+$/u, '').replace(/\s+/gu, '');
  if (!clean || [...clean].some((character) => !ALPHABET.includes(character))) throw new Error('invalid base32 TOTP seed');
  let bits = '';
  for (const character of clean) bits += ALPHABET.indexOf(character).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

export const currentTotp = (base32Seed, nowMs = Date.now(), period = 30, digits = 6) => {
  const counter = Math.floor(nowMs / 1000 / period);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(base32Seed)).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits);
  return {
    code: String(binary).padStart(digits, '0'),
    expiresAt: new Date((counter + 1) * period * 1000).toISOString(),
  };
};

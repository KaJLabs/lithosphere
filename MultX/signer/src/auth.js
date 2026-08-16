import crypto from 'node:crypto';
import fs from 'node:fs';

const normalizeToken = (value) => {
  const token = String(value || '').trim();
  if (token.length < 32 || token.length > 512 || /[\r\n]/.test(token)) {
    throw new Error('signer bearer token must contain 32 to 512 characters');
  }
  return token;
};

export const loadBearerToken = ({ env = process.env } = {}) => {
  const file = env.SIGNER_BEARER_TOKEN_FILE;
  const inline = env.SIGNER_BEARER_TOKEN;
  if (file && inline) throw new Error('configure bearer token file or environment value, never both');
  if (file) return normalizeToken(fs.readFileSync(file, 'utf8'));
  if (inline) return normalizeToken(inline);
  throw new Error('signer bearer token is required');
};

export const hasValidBearerToken = (authorization, expectedToken) => {
  const match = /^Bearer ([^\s]+)$/.exec(String(authorization || ''));
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(expectedToken);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
};

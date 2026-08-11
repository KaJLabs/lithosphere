import crypto from 'crypto';

export const bearerAuthorised = (header, expectedToken) => {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7), 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
};

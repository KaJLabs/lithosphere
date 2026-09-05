import fs from 'node:fs';
import { Wallet } from 'ethers';

export const readSecurePrivateKey = (file, {
  expectedUid = typeof process.getuid === 'function' ? process.getuid() : null,
  enforcePosixPermissions = process.platform !== 'win32',
} = {}) => {
  if (!file) throw new Error('SIGNER_PRIVATE_KEY_FILE is required');
  const pathStat = fs.lstatSync(file);
  if (!pathStat.isFile() || pathStat.isSymbolicLink()) {
    throw new Error('signer private key must be a regular file, not a symlink');
  }
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(file, flags);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new Error('signer private key must remain a regular file');
    if (enforcePosixPermissions && expectedUid !== null && stat.uid !== expectedUid) {
      throw new Error('signer private key must be owned by the signer process UID');
    }
    if (enforcePosixPermissions && (stat.mode & 0o077) !== 0) {
      throw new Error('signer private key must not be accessible by group or other users');
    }
    const value = fs.readFileSync(fd, 'utf8').trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error('signer private key file must contain exactly one 32-byte hex key');
    }
    return value;
  } finally {
    fs.closeSync(fd);
  }
};

export const createSigningKey = async ({ env = process.env } = {}) => {
  const privateKeyFile = env.SIGNER_PRIVATE_KEY_FILE;
  for (const name of ['SIGNER_KMS_KEY_ARN', 'SIGNER_DYNAMODB_TABLE', 'AWS_REGION']) {
    if (env[name]) throw new Error(`${name} is not supported by the non-AWS signer`);
  }
  const wallet = new Wallet(readSecurePrivateKey(privateKeyFile));
  return { kind: 'file', address: wallet.address, signMessage: (message) => wallet.signMessage(message) };
};

import fs from 'node:fs';
import { Wallet } from 'ethers';
import { kmsKeyAddress, kmsSignMessage } from './kmsSigner.js';

const readRequiredFile = (path, label) => {
  if (!path) throw new Error(`${label} is required`);
  const value = fs.readFileSync(path, 'utf8').trim();
  if (!value) throw new Error(`${label} is empty`);
  return value;
};

export const createSigningKey = async ({ env = process.env } = {}) => {
  const kmsKeyArn = env.SIGNER_KMS_KEY_ARN;
  const privateKeyFile = env.SIGNER_PRIVATE_KEY_FILE;
  if (kmsKeyArn && privateKeyFile) throw new Error('configure KMS or a key file, never both');

  if (kmsKeyArn) {
    const address = await kmsKeyAddress(kmsKeyArn, { region: env.AWS_REGION });
    return {
      kind: 'kms',
      address,
      async signMessage(message) {
        return kmsSignMessage({
          keyId: kmsKeyArn,
          message,
          expectedAddress: address,
          region: env.AWS_REGION,
        });
      },
    };
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('production signer requires SIGNER_KMS_KEY_ARN');
  }
  const wallet = new Wallet(readRequiredFile(privateKeyFile, 'SIGNER_PRIVATE_KEY_FILE'));
  return { kind: 'file', address: wallet.address, signMessage: (message) => wallet.signMessage(message) };
};

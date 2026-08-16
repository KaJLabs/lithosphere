import fs from 'node:fs';
import { parseSignerPolicy } from './policy.js';

const readRequiredFile = (file, envName) => {
  const value = fs.readFileSync(file);
  if (value.length === 0) throw new Error(`${envName} is empty`);
  return value;
};

export const loadSignerPolicy = ({
  signingEnabled,
  policyFile = process.env.SIGNER_POLICY_FILE,
  policyJson = process.env.SIGNER_POLICY_JSON,
} = {}) => {
  if (policyFile && policyJson) {
    throw new Error('configure signer policy file or JSON, never both');
  }
  if (!policyFile && !policyJson) {
    if (!signingEnabled) return null;
    throw new Error('SIGNER_POLICY_FILE or SIGNER_POLICY_JSON is required when signing is enabled');
  }

  const serialized = policyFile
    ? readRequiredFile(policyFile, 'SIGNER_POLICY_FILE').toString('utf8')
    : policyJson;
  return parseSignerPolicy(JSON.parse(serialized));
};

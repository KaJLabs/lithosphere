import { ethers } from 'ethers';

export function positiveSafeInteger(value, label) {
  const text = String(value ?? '');
  if (!/^[1-9][0-9]*$/.test(text)) throw new Error(`${label} must be a positive integer`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds JavaScript's safe integer range`);
  return parsed;
}

export function validateValidatorSet(validators, signaturesRequired) {
  const required = positiveSafeInteger(signaturesRequired, 'SIGNATURES_REQUIRED');
  if (!Array.isArray(validators) || validators.length === 0) {
    throw new Error('No validator signers are configured');
  }
  const addresses = validators.map((validator, index) => {
    try {
      const address = ethers.getAddress(validator.address);
      if (address === ethers.ZeroAddress) throw new Error('zero address');
      return address.toLowerCase();
    }
    catch { throw new Error(`validator ${index} has an invalid address`); }
  });
  if (new Set(addresses).size !== addresses.length) {
    throw new Error('validator signer addresses must be unique');
  }
  if (addresses.length < required) {
    throw new Error(`Loaded ${addresses.length} signer(s), below configured threshold ${required}`);
  }
  return { required, addresses };
}

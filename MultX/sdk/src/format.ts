import { ethers } from 'ethers';

/**
 * Returns true if `address` parses as a valid EVM checksum/lowercase address.
 * Used as a "deployed?" sentinel — when the bridge address is empty or `0x`,
 * the contract is treated as not deployed in the current build.
 */
export const isContractDeployed = (address: unknown): boolean => {
  try {
    return ethers.isAddress(String(address ?? '').trim());
  } catch {
    return false;
  }
};

/**
 * Format a raw on-chain amount (base units) to a human-readable decimal string,
 * fixed to 6 decimal places. Mirrors the kamet-explorer behavior — does not
 * use BigNumber arithmetic; sufficient precision for UI display.
 */
export const formatTokenAmount = (
  amount: number | string,
  decimals = 18,
): string => (Number(amount) / Math.pow(10, decimals)).toFixed(6);

/**
 * Parse a human-readable decimal amount into a raw base-unit integer string.
 * Floors the result to avoid floating-point fractional units.
 */
export const parseTokenAmount = (
  amount: number | string,
  decimals = 18,
): string => Math.floor(Number(amount) * Math.pow(10, decimals)).toString();

/**
 * Returns a normalized checksummed EVM address, or empty string when the input
 * is not a valid address (or is `0x` / empty).
 */
export const normalizeAddress = (value: unknown = ''): string => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === '0x') return '';
  try {
    return ethers.isAddress(trimmed) ? ethers.getAddress(trimmed) : '';
  } catch {
    return '';
  }
};

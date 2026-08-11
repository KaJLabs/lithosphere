import { ethers } from 'ethers5';

// Format a BigNumber to a fixed-decimal string. Returns '0' on null / parse error.
// Used by DEX, Bridge, and any other page rendering on-chain amounts.
export const formatBN = (bn, decimals = 18, frac = 6) => {
  if (!bn) return '0';
  try {
    return Number(ethers.utils.formatUnits(bn, decimals)).toFixed(frac);
  } catch {
    return '0';
  }
};

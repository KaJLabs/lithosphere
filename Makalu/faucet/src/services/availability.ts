import { formatUnits, parseUnits } from 'viem';

import type { FaucetAsset } from '../config.js';

export interface AssetAvailability {
  available: boolean;
  claimableAmounts: string[];
  minimumClaimAmount: string;
  shortfall: string;
}

/**
 * Derive claimability from the live wallet balance without floating-point
 * conversions. An asset stays visible when depleted, but clients can disable
 * claims and show operators the exact funding shortfall.
 */
export function getAssetAvailability(asset: FaucetAsset, balance: string): AssetAvailability {
  const allowed = asset.allowedAmounts
    .map((amount) => ({ amount, raw: parseUnits(amount, asset.decimals) }))
    .sort((a, b) => (a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0));
  const minimum = allowed[0];

  let balanceRaw = 0n;
  try {
    balanceRaw = parseUnits(balance, asset.decimals);
  } catch {
    balanceRaw = 0n;
  }

  const claimableAmounts = allowed
    .filter(({ raw }) => raw <= balanceRaw)
    .map(({ amount }) => amount);
  const shortfallRaw = balanceRaw >= minimum.raw ? 0n : minimum.raw - balanceRaw;

  return {
    available: claimableAmounts.length > 0,
    claimableAmounts,
    minimumClaimAmount: minimum.amount,
    shortfall: formatUnits(shortfallRaw, asset.decimals),
  };
}

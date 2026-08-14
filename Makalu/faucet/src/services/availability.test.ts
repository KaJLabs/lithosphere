import assert from 'node:assert/strict';
import test from 'node:test';

import type { TokenFaucetAsset } from '../config.js';
import { getAssetAvailability } from './availability.js';

const asset: TokenFaucetAsset = {
  id: 'test',
  name: 'Test asset',
  symbol: 'TEST',
  kind: 'erc20',
  standard: 'LEP-100',
  decimals: 18,
  allowedAmounts: ['10', '25', '50'],
  defaultAmount: '10',
  contractAddress: '0x1111111111111111111111111111111111111111',
};

test('zero balance disables every claim and reports the minimum shortfall', () => {
  assert.deepEqual(getAssetAvailability(asset, '0'), {
    available: false,
    claimableAmounts: [],
    minimumClaimAmount: '10',
    shortfall: '10',
  });
});

test('below-minimum balance remains unavailable', () => {
  assert.deepEqual(getAssetAvailability(asset, '5'), {
    available: false,
    claimableAmounts: [],
    minimumClaimAmount: '10',
    shortfall: '5',
  });
});

test('balance exposes only claim amounts the faucet can satisfy', () => {
  assert.deepEqual(getAssetAvailability(asset, '25'), {
    available: true,
    claimableAmounts: ['10', '25'],
    minimumClaimAmount: '10',
    shortfall: '0',
  });
});

test('malformed balance fails closed', () => {
  assert.deepEqual(getAssetAvailability(asset, 'not-a-balance'), {
    available: false,
    claimableAmounts: [],
    minimumClaimAmount: '10',
    shortfall: '10',
  });
});

test('fractional values are compared using token precision rather than floats', () => {
  const fractionalAsset: TokenFaucetAsset = {
    ...asset,
    decimals: 6,
    allowedAmounts: ['0.1', '0.25'],
    defaultAmount: '0.1',
  };

  assert.deepEqual(getAssetAvailability(fractionalAsset, '0.249999'), {
    available: true,
    claimableAmounts: ['0.1'],
    minimumClaimAmount: '0.1',
    shortfall: '0',
  });
});

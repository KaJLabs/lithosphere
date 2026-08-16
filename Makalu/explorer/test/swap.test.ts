import { describe, expect, it } from 'vitest';

import {
  WLITHO_ADDRESS,
  buildPath,
  describeSwapError,
  formatAmount,
  minOut,
} from '@/lib/swap';

const TOKEN_A = '0x1111111111111111111111111111111111111111';
const TOKEN_B = '0x2222222222222222222222222222222222222222';

describe('Lithoswap routing helpers', () => {
  it('uses a direct route when either side is wLITHO', () => {
    expect(buildPath(WLITHO_ADDRESS, TOKEN_A)).toEqual([WLITHO_ADDRESS, TOKEN_A]);
    expect(buildPath(TOKEN_A, WLITHO_ADDRESS)).toEqual([TOKEN_A, WLITHO_ADDRESS]);
  });

  it('routes token-to-token swaps through wLITHO', () => {
    expect(buildPath(TOKEN_A, TOKEN_B)).toEqual([TOKEN_A, WLITHO_ADDRESS, TOKEN_B]);
  });

  it('applies slippage in basis points without floating point math', () => {
    expect(minOut(1_000_000n, 50)).toBe(995_000n);
    expect(minOut(1_000_000n, 100)).toBe(990_000n);
  });

  it('formats token amounts compactly', () => {
    expect(formatAmount(1_234_560_000_000_000_000n, 18)).toBe('1.23456');
    expect(formatAmount(1_000_000_000_000_000_000n, 18)).toBe('1');
  });

  it('turns wallet and liquidity failures into actionable messages', () => {
    expect(describeSwapError({ code: 'ACTION_REJECTED' }, 'LAX')).toContain('cancelled');
    expect(describeSwapError({ reason: 'INSUFFICIENT_LIQUIDITY' }, 'LAX')).toContain('no liquidity');
    expect(describeSwapError({ reason: 'INSUFFICIENT_OUTPUT_AMOUNT' }, 'LAX')).toContain('slippage');
  });
});

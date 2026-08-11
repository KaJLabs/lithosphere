import { describe, expect, it } from 'vitest';
import {
  KAMET_EVM_CHAIN_ID,
  LITHO_MAINNET_EVM_CHAIN_ID,
  MAKALU_EVM_CHAIN_ID,
  parseConfiguredEvmChainId,
  resolveSeededTokens,
  resolveStaleTokenAddresses,
} from '../token-registry.js';

describe('chain-specific token registry', () => {
  it('defaults to Makalu only when LITHO_CHAIN_ID is absent', () => {
    expect(parseConfiguredEvmChainId(undefined)).toBe(MAKALU_EVM_CHAIN_ID);
  });

  it.each(['', '0', '-1', 'not-a-chain', '1.5', String(Number.MAX_SAFE_INTEGER + 1)])(
    'rejects invalid configured chain ID %j',
    (value) => {
      expect(() => parseConfiguredEvmChainId(value)).toThrow(
        'LITHO_CHAIN_ID must be a positive safe integer',
      );
    },
  );

  it('returns the canonical Makalu registry on chain 700777', () => {
    const tokens = resolveSeededTokens(MAKALU_EVM_CHAIN_ID);
    expect(tokens).toHaveLength(10);
    expect(tokens.find((token) => token.symbol === 'LAX')?.address).toBe(
      '0x1Cde2Ca6c2ab8622003ebe06e382bC07850d4B8d',
    );
    expect(tokens.some((token) => token.symbol === 'QTT')).toBe(false);
  });

  it('returns the RPC-verified Kamet registry on chain 900523', () => {
    const tokens = resolveSeededTokens(KAMET_EVM_CHAIN_ID);
    expect(tokens).toHaveLength(11);
    expect(tokens.find((token) => token.symbol === 'LAX')?.address).toBe(
      '0xe8f504f9cE5391Fb5968b317f0b24b8A0306ACeb',
    );
    expect(tokens.find((token) => token.symbol === 'QTT')?.address).toBe(
      '0x16EE7127C9E03e29ca5727e23dd7CB03D283cDBe',
    );
  });

  it('seeds no testnet tokens on LITHO mainnet or an unknown chain', () => {
    expect(resolveSeededTokens(LITHO_MAINNET_EVM_CHAIN_ID)).toEqual([]);
    expect(resolveSeededTokens(123456789)).toEqual([]);
  });

  it('marks foreign registry addresses stale without removing active addresses', () => {
    const kametActive = new Set(
      resolveSeededTokens(KAMET_EVM_CHAIN_ID).map((token) => token.address.toLowerCase()),
    );
    const kametStale = resolveStaleTokenAddresses(KAMET_EVM_CHAIN_ID);

    expect(kametStale).toContain('0x1cde2ca6c2ab8622003ebe06e382bc07850d4b8d');
    expect(kametStale).not.toContain('0xe8f504f9ce5391fb5968b317f0b24b8a0306aceb');
    expect(kametStale.some((address) => kametActive.has(address))).toBe(false);

    const mainnetStale = resolveStaleTokenAddresses(LITHO_MAINNET_EVM_CHAIN_ID);
    expect(mainnetStale).toContain('0x1cde2ca6c2ab8622003ebe06e382bc07850d4b8d');
    expect(mainnetStale).toContain('0xe8f504f9ce5391fb5968b317f0b24b8a0306aceb');
  });
});

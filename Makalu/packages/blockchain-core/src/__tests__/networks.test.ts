import { describe, expect, it } from 'vitest';

import {
  NETWORKS,
  ErrorCode,
  LithoError,
  LEP100_ABI,
  WLITHO_ABI,
  LITHONATIVE_ABI,
  getNetwork,
  isNetworkName,
  VERSION,
} from '../index.js';

describe('NETWORKS registry', () => {
  it.each(['mainnet', 'staging', 'devnet', 'local'] as const)(
    '%s has a non-empty rpcUrl, chainId 700777, and litho bech32 prefix',
    (name) => {
      const net = NETWORKS[name];
      expect(net.name).toBe(name);
      expect(net.rpcUrl).toMatch(/^https?:\/\//);
      expect(net.chainId).toBe(700777);
      expect(net.bech32Prefix).toBe('litho');
      expect(net.currency.symbol).toBe('LITHO');
      expect(net.currency.decimals).toBe(18);
      expect(net.currency.denom).toBe('ulitho');
    },
  );

  it('marks the local profile as non-public', () => {
    expect(NETWORKS.local.isPublic).toBe(false);
    expect(NETWORKS.mainnet.isPublic).toBe(true);
  });

  it('routes public profiles at the same testnet endpoints (no separate mainnet yet)', () => {
    // Documents the intentional aliasing — if a real mainnet ever spins up, this
    // test will fail and force the registry to be updated alongside the live URLs.
    expect(NETWORKS.staging.rpcUrl).toBe(NETWORKS.mainnet.rpcUrl);
    expect(NETWORKS.devnet.rpcUrl).toBe(NETWORKS.mainnet.rpcUrl);
  });
});

describe('isNetworkName / getNetwork', () => {
  it('isNetworkName narrows to NetworkName', () => {
    expect(isNetworkName('mainnet')).toBe(true);
    expect(isNetworkName('not-a-network')).toBe(false);
  });

  it('getNetwork returns the live config', () => {
    expect(getNetwork('mainnet').chainId).toBe(700777);
  });
});

describe('LithoError', () => {
  it('carries a typed code and preserves cause', () => {
    const cause = new Error('underlying');
    const err = new LithoError(ErrorCode.RPC_TIMEOUT, 'timed out', { cause });
    expect(err).toBeInstanceOf(LithoError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(ErrorCode.RPC_TIMEOUT);
    expect(err.name).toBe('LithoError');
    expect(err.cause).toBe(cause);
  });
});

describe('ABI exports', () => {
  it('exports LEP100, WLITHO, LITHONATIVE ABIs as arrays', () => {
    expect(Array.isArray(LEP100_ABI)).toBe(true);
    expect(LEP100_ABI.length).toBeGreaterThan(0);
    expect(Array.isArray(WLITHO_ABI)).toBe(true);
    expect(WLITHO_ABI.length).toBeGreaterThan(0);
    expect(Array.isArray(LITHONATIVE_ABI)).toBe(true);
    expect(LITHONATIVE_ABI.length).toBeGreaterThan(0);
  });

  it('LEP100 ABI exposes balanceOf and totalSupply functions', () => {
    const fnNames = (LEP100_ABI as ReadonlyArray<{ type?: string; name?: string }>)
      .filter((e) => e.type === 'function')
      .map((e) => e.name);
    expect(fnNames).toEqual(expect.arrayContaining(['balanceOf', 'totalSupply']));
  });
});

describe('VERSION', () => {
  it('matches semver', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

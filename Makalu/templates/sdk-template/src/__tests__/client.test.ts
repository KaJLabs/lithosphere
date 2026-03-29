import { describe, expect, it } from 'vitest';

import { LithoClient } from '../client.js';
import { ErrorCode, LithoError, NETWORKS } from '../types.js';

describe('LithoClient', () => {
  describe('constructor', () => {
    it('should create client with network name', () => {
      const client = new LithoClient('mainnet');
      expect(client).toBeInstanceOf(LithoClient);
    });

    it('should create client with custom RPC URL', () => {
      const client = new LithoClient('https://custom-rpc.example.com');
      expect(client).toBeInstanceOf(LithoClient);
    });

    it('should throw on invalid RPC URL', () => {
      expect(() => new LithoClient('invalid-url')).toThrow(LithoError);
    });
  });

  describe('getNetworkConfig', () => {
    it('should return network config for known networks', () => {
      const client = new LithoClient('mainnet');
      const config = client.getNetworkConfig();
      expect(config).toEqual(NETWORKS.mainnet);
    });

    it('should return null for custom RPC', () => {
      const client = new LithoClient('https://custom-rpc.example.com');
      const config = client.getNetworkConfig();
      expect(config).toBeNull();
    });
  });
});

describe('NETWORKS', () => {
  it('should have mainnet configuration', () => {
    expect(NETWORKS.mainnet).toBeDefined();
    expect(NETWORKS.mainnet.chainId).toBe(999);
    expect(NETWORKS.mainnet.currency.symbol).toBe('LITHO');
  });

  it('should have devnet configuration', () => {
    expect(NETWORKS.devnet).toBeDefined();
    expect(NETWORKS.devnet.chainId).toBe(1000);
  });

  it('should have local configuration', () => {
    expect(NETWORKS.local).toBeDefined();
    expect(NETWORKS.local.chainId).toBe(31337);
    expect(NETWORKS.local.rpcUrl).toBe('http://localhost:8545');
  });
});

describe('LithoError', () => {
  it('should create error with code and message', () => {
    const error = new LithoError(ErrorCode.INVALID_ADDRESS, 'Invalid address');
    expect(error.code).toBe(ErrorCode.INVALID_ADDRESS);
    expect(error.message).toBe('Invalid address');
    expect(error.name).toBe('LithoError');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Original error');
    const error = new LithoError(ErrorCode.NETWORK_ERROR, 'Network failed', {
      cause,
    });
    expect(error.cause).toBe(cause);
  });
});

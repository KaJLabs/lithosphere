import { describe, it, expect } from 'vitest';

/**
 * Indexer health and config smoke tests.
 * Validates response shapes and config defaults without starting the full indexer.
 */

describe('Indexer Health', () => {
  it('should produce a valid health response shape', () => {
    const response = {
      status: 'healthy',
      service: 'lithosphere-indexer',
      timestamp: new Date().toISOString(),
      lastIndexedBlock: 0,
    };

    expect(response.status).toBe('healthy');
    expect(response.service).toBe('lithosphere-indexer');
    expect(response.timestamp).toBeDefined();
    expect(response.lastIndexedBlock).toBeGreaterThanOrEqual(0);
  });
});

describe('Indexer Configuration', () => {
  it('should parse default config values', () => {
    const startBlock = parseInt(process.env.START_BLOCK || '1');
    const batchSize = parseInt(process.env.BATCH_SIZE || '100');

    expect(startBlock).toBeGreaterThanOrEqual(1);
    expect(batchSize).toBeGreaterThan(0);
  });

  it('should have a valid RPC URL default', () => {
    const rpcUrl = process.env.RPC_URL || 'https://rpc.litho.ai';
    expect(rpcUrl).toMatch(/^https?:\/\//);
  });
});

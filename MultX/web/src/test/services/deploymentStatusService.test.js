import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/api', () => ({
  CHAIN_CONFIG: {
    faucetClaimUrl: 'https://api-3.litho.ai/faucet/claim'
  }
}));

vi.mock('../../config/multx', () => ({
  MULTX_CONFIG: {
    bridgeApiUrl: 'https://bridge.litho.ai',
    bridgeAddress: '0x95B646bF6629A379AD898DC58D011fd3111e5700',
    lithoTokenAddress: '0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2'
  },
  MultXAPI: {
    health: () => 'https://bridge.litho.ai/health'
  }
}));

import {
  createInitialBridgeDeploymentStatus,
  createInitialFaucetAvailability,
  fetchBridgeDeploymentStatus,
  probeFaucetClaimAvailability
} from '../../services/deploymentStatusService';

describe('deploymentStatusService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('starts faucet availability in checking mode when a claim url is configured', () => {
    expect(createInitialFaucetAvailability()).toMatchObject({
      configured: true,
      ready: false,
      status: 'checking'
    });
  });

  it('treats the faucet route as ready when an invalid probe returns 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 400,
      text: async () => JSON.stringify({
        message: 'Invalid wallet address.'
      })
    });

    const result = await probeFaucetClaimAvailability();

    expect(result.ready).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.statusCode).toBe(400);
  });

  it('marks the faucet route as missing when the live endpoint returns 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      text: async () => ''
    });

    const result = await probeFaucetClaimAvailability();

    expect(result.ready).toBe(false);
    expect(result.status).toBe('missing');
    expect(result.message).toContain('not mounted');
  });

  it('reports bridge deployment readiness when health confirms both contracts', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          deployment: {
            bridgeAddress: '0x95B646bF6629A379AD898DC58D011fd3111e5700',
            bridgeContractDeployed: true,
            kametTokenAddress: '0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2',
            kametTokenContractDeployed: true,
            ready: true,
            error: ''
          }
        })
    });

    const result = await fetchBridgeDeploymentStatus();

    expect(result.ready).toBe(true);
    expect(result.apiAvailable).toBe(true);
    expect(result.message).toContain('ready');
  });

  it('reports maintenance mode when the configured bridge contract is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          deployment: {
            bridgeAddress: '0x95B646bF6629A379AD898DC58D011fd3111e5700',
            bridgeContractDeployed: false,
            kametTokenAddress: '0x4D1fc3b424CF86aeF2B2fa503acf97eB1bFb88a2',
            kametTokenContractDeployed: true,
            ready: false,
            error: ''
          }
        })
    });

    const result = await fetchBridgeDeploymentStatus();

    expect(createInitialBridgeDeploymentStatus().status).toBe('checking');
    expect(result.ready).toBe(false);
    expect(result.bridgeContractReady).toBe(false);
    expect(result.message).toContain('bridge contract');
  });
});

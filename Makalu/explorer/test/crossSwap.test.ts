import { describe, expect, it } from 'vitest';

import {
  createSaga,
  currentStep,
  describeStep,
  planRoute,
  type SagaConfig,
  type SagaState,
} from '@/lib/crossSwap';

const config: SagaConfig = {
  symbolIn: 'wLITHO',
  symbolOut: 'LAX',
  chainXKey: 'kamet',
  chainYKey: 'bnb',
  amountIn: '10',
  slippageBps: 50,
};

describe('cross-chain swap saga', () => {
  it('plans only the legs required by source and destination', () => {
    expect(planRoute('makalu', 'makalu')).toEqual(['swap']);
    expect(planRoute('kamet', 'makalu')).toEqual(['bridge_in', 'swap']);
    expect(planRoute('makalu', 'kamet')).toEqual(['swap', 'bridge_out']);
    expect(planRoute('kamet', 'bnb')).toEqual(['bridge_in', 'swap', 'bridge_out']);
  });

  it('starts a persisted saga at the first bridge lock', () => {
    const saga = createSaga(config);
    expect(saga.status).toBe('active');
    expect(currentStep(saga)).toBe('bridge_in_lock');
    expect(describeStep(saga)).toMatchObject({ chainKey: 'kamet', chainId: 900523 });
  });

  it('resumes at claim, swap, bridge-out, and relayer steps', () => {
    const base = createSaga(config);
    const lockedIn: SagaState = { ...base, bridgeIn: { bridgeTxHash: '0xbridge-in' } };
    expect(currentStep(lockedIn)).toBe('bridge_in_claim');

    const claimedIn: SagaState = { ...lockedIn, bridgeIn: { ...lockedIn.bridgeIn, claimed: true } };
    expect(currentStep(claimedIn)).toBe('swap');

    const swapped: SagaState = { ...claimedIn, swap: { txHash: '0xswap', receivedB: '100' } };
    expect(currentStep(swapped)).toBe('bridge_out_lock');

    const lockedOut: SagaState = { ...swapped, bridgeOut: { bridgeTxHash: '0xbridge-out' } };
    expect(currentStep(lockedOut)).toBe('await_relayer');

    const released: SagaState = {
      ...lockedOut,
      bridgeOut: { ...lockedOut.bridgeOut, releaseTxHash: '0xrelease' },
    };
    expect(currentStep(released)).toBe('done');
  });
});

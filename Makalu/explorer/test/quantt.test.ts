import { describe, expect, it } from 'vitest';
import { normalizeQuanttInsight } from '@/lib/quantt';

describe('Quantt response normalization', () => {
  it('normalizes a direct response', () => {
    expect(normalizeQuanttInsight({
      summary: 'Momentum is improving.',
      signal: 'bullish',
      confidence: '0.82',
      updated_at: '2026-07-22T00:00:00Z',
    })).toMatchObject({
      summary: 'Momentum is improving.',
      signal: 'bullish',
      score: 0.82,
      updatedAt: '2026-07-22T00:00:00Z',
    });
  });

  it('supports nested provider results and rejects non-numeric scores', () => {
    expect(normalizeQuanttInsight({ result: { analysis: 'Neutral.', sentiment: 'neutral', score: 'unknown' } })).toMatchObject({
      summary: 'Neutral.',
      signal: 'neutral',
      score: null,
    });
  });
});

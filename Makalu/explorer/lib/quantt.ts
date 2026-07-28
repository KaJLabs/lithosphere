export interface QuanttStatus {
  ok: boolean;
  configured: boolean;
  researchUrl: string;
  developerUrl: string;
  apiOrigin: string | null;
}

export interface QuanttInsightResponse {
  ok: boolean;
  provider: 'quantt';
  symbol: string;
  data: unknown;
}

export interface QuanttInsight {
  summary: string | null;
  signal: string | null;
  score: number | null;
  updatedAt: string | null;
  raw: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function normalizeQuanttInsight(value: unknown): QuanttInsight {
  const root = asRecord(value) ?? {};
  const nested = asRecord(root.insight) ?? asRecord(root.result) ?? root;
  const rawScore = nested.score ?? nested.confidence ?? nested.probability;
  const parsedScore = typeof rawScore === 'number'
    ? rawScore
    : (typeof rawScore === 'string' && rawScore.trim() ? Number(rawScore) : NaN);

  return {
    summary: firstString(nested, ['summary', 'analysis', 'description', 'message']),
    signal: firstString(nested, ['signal', 'sentiment', 'recommendation', 'direction']),
    score: Number.isFinite(parsedScore) ? parsedScore : null,
    updatedAt: firstString(nested, ['updatedAt', 'updated_at', 'timestamp', 'createdAt']),
    raw: value,
  };
}

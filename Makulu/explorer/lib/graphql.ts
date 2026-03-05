import { useState, useEffect, useCallback, useRef } from 'react';

export async function fetchGQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

interface UseGraphQLResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { pollInterval?: number; skip?: boolean }
): UseGraphQLResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const varsRef = useRef(variables);
  const queryRef = useRef(query);

  varsRef.current = variables;
  queryRef.current = query;

  const doFetch = useCallback(async () => {
    if (options?.skip) return;
    try {
      const result = await fetchGQL<T>(queryRef.current, varsRef.current);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [options?.skip]);

  useEffect(() => {
    setLoading(true);
    doFetch();
  }, [doFetch, query, JSON.stringify(variables)]);

  useEffect(() => {
    if (!options?.pollInterval || options?.skip) return;
    const id = setInterval(doFetch, options.pollInterval);
    return () => clearInterval(id);
  }, [doFetch, options?.pollInterval, options?.skip]);

  return { data, loading, error, refetch: doFetch };
}

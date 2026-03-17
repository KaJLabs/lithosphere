import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Fetch from the REST API via the /_api proxy path.
 *
 * External nginx intercepts /api/* and routes it to the validator's Fastify
 * API on port 8080. By using /_api/*, requests go through the Next.js server
 * (nginx routes / → :3100) which rewrites them to our Express API on :4000.
 */
export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/_api${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // API returns JSON error bodies like {"statusCode":404,"message":"Block not found"}
    // Extract the human-readable message instead of showing raw JSON.
    let msg = `Request failed (${res.status})`;
    if (text) {
      try {
        const json = JSON.parse(text);
        msg = json.message || json.error || msg;
      } catch {
        msg = text;
      }
    }
    throw new Error(msg);
  }
  return res.json();
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  path: string | null,
  options?: { pollInterval?: number }
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const doFetch = useCallback(async () => {
    if (!pathRef.current) return;
    try {
      const result = await apiFetch<T>(pathRef.current);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    doFetch();
  }, [path, doFetch]);

  useEffect(() => {
    if (!options?.pollInterval || !path) return;
    const id = setInterval(doFetch, options.pollInterval);
    return () => clearInterval(id);
  }, [doFetch, options?.pollInterval, path]);

  return { data, loading, error, refetch: doFetch };
}

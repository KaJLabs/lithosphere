import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Catch-all API proxy: /_api/* → http://api:4000/api/*
 *
 * External nginx intercepts /api/* and routes it to the validator's Fastify
 * API on :8080. This proxy route uses /_api/* which nginx passes through to
 * the Next.js server (:3100), and we forward to our Express API on :4000.
 */
const API_BASE = process.env.API_INTERNAL_URL || 'http://api:4000';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const pathSegments = req.query.path;
  const apiPath = Array.isArray(pathSegments)
    ? pathSegments.join('/')
    : pathSegments ?? '';

  // Build the target URL preserving query params
  const url = new URL(`/api/${apiPath}`, API_BASE);
  if (req.url) {
    const incoming = new URL(req.url, 'http://localhost');
    incoming.searchParams.forEach((v, k) => {
      if (k !== 'path') url.searchParams.set(k, v);
    });
  }

  try {
    const headers: Record<string, string> = {
      'accept': 'application/json',
    };
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    }

    const fetchOpts: RequestInit = {
      method: req.method || 'GET',
      headers,
      signal: AbortSignal.timeout(30_000),
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOpts.body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
    }

    const upstream = await fetch(url.toString(), fetchOpts);
    const contentType = upstream.headers.get('content-type') || 'application/json';

    res.status(upstream.status);
    res.setHeader('content-type', contentType);

    const body = await upstream.text();
    res.send(body);
  } catch (err) {
    console.error(`[_api proxy] ${req.method} /api/${apiPath} failed:`, err);
    res.status(502).json({
      error: 'API proxy error',
      message: err instanceof Error ? err.message : String(err),
      target: url.toString(),
    });
  }
}

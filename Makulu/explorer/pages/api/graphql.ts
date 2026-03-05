import type { NextApiRequest, NextApiResponse } from 'next';

// Server-side proxy: resolves via Docker DNS (service name "api" on litho-network)
const API_URL = process.env.API_INTERNAL_URL || 'http://api:4000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const upstream = await fetch(`${API_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return res.status(502).json({ errors: [{ message: `API unreachable: ${message}` }] });
  }
}

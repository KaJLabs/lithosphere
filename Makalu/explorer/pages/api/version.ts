/**
 * GET /api/version — server-side build metadata for the explorer.
 *
 * Mirrors the api (`:4000/version`) and indexer (`:3001/version`) endpoints
 * so deploy-simple.yaml's SHA-verification step can include the explorer in
 * the three-way SHA match. Without this, a stale-explorer-but-fresh-api
 * deploy would silently succeed.
 *
 * Note on routing: next.config.js rewrites `/api/*` to the upstream API
 * server for everything that isn't a local Next.js API route, but local
 * `pages/api/*` files take precedence over rewrites. This handler is
 * served by the explorer process itself, not proxied.
 */
import { buildVersionResponse, type VersionResponse } from '../../lib/build-info';

import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse<VersionResponse>) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(buildVersionResponse());
}

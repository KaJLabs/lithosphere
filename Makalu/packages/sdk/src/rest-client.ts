/**
 * REST client for the Lithosphere indexer API.
 *
 * Thin factory over `openapi-fetch` typed against the generated `paths`
 * interface (auto-generated from `docs/api-reference/openapi.yaml` and
 * drift-gated in CI). End-to-end type safety: path strings autocomplete,
 * query params are validated, and response bodies type-narrow against
 * the OpenAPI schema.
 *
 * Example:
 *
 *   import { createLithoRestClient, NETWORKS } from '@lithosphere/sdk';
 *
 *   const api = createLithoRestClient({ baseUrl: NETWORKS.mainnet.apiUrl });
 *   const { data, error } = await api.GET('/blocks', { params: { query: { limit: 10 } } });
 *   if (error) throw new Error(`API ${error}`);
 *   data.blocks.forEach((b) => console.log(b.height));
 *
 * Why a factory instead of a singleton?
 *   Tests + multi-network setups (mainnet probing vs local devnet) need
 *   independent clients. The factory pattern stays out of the way for the
 *   common single-network case (one call site, one client) but enables
 *   the rest.
 */
import createClient, { type Client, type ClientOptions } from 'openapi-fetch';
import type { paths } from './generated/openapi.js';

export interface CreateRestClientOptions extends Omit<ClientOptions, 'baseUrl'> {
  /**
   * Base URL of the Lithosphere API.
   * For the published Makalu testnet: `https://makalu.litho.ai/api`.
   * For local dev (docker-compose): `http://localhost:4000/api`.
   */
  baseUrl: string;
}

export type LithoRestClient = Client<paths>;

/**
 * Build a typed REST client for the Lithosphere indexer API.
 *
 * Accepts any standard `openapi-fetch` options (headers, custom fetch,
 * request middlewares, etc.) plus a required `baseUrl`.
 */
export function createLithoRestClient(options: CreateRestClientOptions): LithoRestClient {
  return createClient<paths>(options);
}

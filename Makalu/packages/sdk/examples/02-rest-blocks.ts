/**
 * Hits the live Makalu indexer REST API via the typed REST client.
 *
 *   pnpm exec tsx examples/02-rest-blocks.ts
 *
 * Shows the end-to-end type-safety chain:
 *   docs/api-reference/openapi.yaml  →  src/generated/openapi.ts
 *     →  Client<paths>  →  api.GET('/blocks', { params: { query: {...} } })
 *
 * The path string, query params, and response body all autocomplete and
 * type-narrow in your editor — fork the file, hover any identifier.
 */
import { createLithoRestClient } from '@lithosphere/sdk';

async function main() {
  const api = createLithoRestClient({ baseUrl: 'https://makalu.litho.ai/api' });

  // List the 5 most recent blocks.
  const list = await api.GET('/blocks', { params: { query: { limit: 5 } } });
  if (list.error) {
    console.error('[list] error', list.error);
    process.exit(1);
  }
  console.log('[list] /blocks (limit=5):');
  console.log(JSON.stringify(list.data, null, 2));

  // Drill into the top block by height. The `paths` type forces us to
  // narrow `data` before reading nested fields — we accept the JsonObject
  // shape from the spec and pull `.height` off pragmatically.
  type BlocksResp = { blocks?: Array<{ height?: number }> } | undefined;
  const topHeight = (list.data as BlocksResp)?.blocks?.[0]?.height;
  if (typeof topHeight !== 'number') {
    console.log('[detail] no top block returned, skipping detail call');
    return;
  }

  const detail = await api.GET('/blocks/{height}', {
    params: { path: { height: topHeight } },
  });
  if (detail.error) {
    console.error('[detail] error', detail.error);
    process.exit(1);
  }
  console.log(`[detail] /blocks/${topHeight}:`);
  console.log(JSON.stringify(detail.data, null, 2));
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});

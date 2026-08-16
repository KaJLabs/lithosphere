import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getFaucetAssetBalances, getFaucetBalance, getFaucetAddress } from '../services/wallet.js';
import { getAssetAvailability } from '../services/availability.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (request, reply) => {
    try {
      const [balance, balances] = await Promise.all([
        getFaucetBalance(),
        getFaucetAssetBalances(),
      ]);
      const address = getFaucetAddress();
      const assets = config.assets.map((asset) => {
        const assetBalance = balances[asset.id] ?? '0';
        return {
          id: asset.id,
          name: asset.name,
          symbol: asset.symbol,
          kind: asset.kind,
          standard: asset.standard,
          decimals: asset.decimals,
          allowedAmounts: asset.allowedAmounts,
          defaultAmount: asset.defaultAmount,
          contractAddress: asset.kind === 'erc20' ? asset.contractAddress : null,
          balance: assetBalance,
          ...getAssetAvailability(asset, assetBalance),
        };
      });
      const unavailableAssetIds = assets
        .filter((asset) => !asset.available)
        .map((asset) => asset.id);

      return reply.send({
        status: unavailableAssetIds.length > 0 ? 'degraded' : 'ok',
        ready: unavailableAssetIds.length === 0,
        service: 'lithosphere-faucet',
        faucetAddress: address,
        balance: `${balance} ${config.nativeAsset.symbol}`,
        allowedAmounts: config.allowedAmounts,
        defaultAmount: config.dripAmount,
        defaultAssetId: config.defaultAssetId,
        assets,
        unavailableAssetIds,
        cooldownHours: config.cooldownHours,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Surface the cause — a bare 503 here previously gave ops no signal why
      // the faucet appeared "unavailable" (e.g. a malformed FAUCET_PRIVATE_KEY
      // throwing in getFaucetAddress, or the RPC being unreachable).
      request.log.error(
        { err: error instanceof Error ? error.message : String(error) },
        '[faucet] /health check failed',
      );
      return reply.status(503).send({
        status: 'error',
        service: 'lithosphere-faucet',
        message: error instanceof Error ? error.message : 'Faucet health check failed',
      });
    }
  });
}

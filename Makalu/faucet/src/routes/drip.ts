import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { isAddress } from 'viem';
import { drip as sendDrip, getAssetBalance as readAssetBalance } from '../services/wallet.js';
import { getAssetAvailability as deriveAssetAvailability } from '../services/availability.js';
import { checkCooldown as readCooldown, setCooldown as writeCooldown } from '../services/rateLimit.js';
import { config, getAssetConfig, isAllowedAmount } from '../config.js';

interface DripBody {
  address: string;
  amount?: string;
  assetId?: string;
  asset?: string;
}

export interface DripRouteDependencies {
  drip: typeof sendDrip;
  getAssetBalance: typeof readAssetBalance;
  getAssetAvailability: typeof deriveAssetAvailability;
  checkCooldown: typeof readCooldown;
  setCooldown: typeof writeCooldown;
}

export interface DripRouteOptions extends FastifyPluginOptions {
  dependencies?: DripRouteDependencies;
}

const defaultDependencies: DripRouteDependencies = {
  drip: sendDrip,
  getAssetBalance: readAssetBalance,
  getAssetAvailability: deriveAssetAvailability,
  checkCooldown: readCooldown,
  setCooldown: writeCooldown,
};

export async function dripRoutes(
  app: FastifyInstance,
  options: DripRouteOptions = {},
) {
  const dependencies = options.dependencies ?? defaultDependencies;
  const {
    drip,
    getAssetBalance,
    getAssetAvailability,
    checkCooldown,
    setCooldown,
  } = dependencies;

  app.post<{ Body: DripBody }>('/drip', async (request, reply) => {
    const {
      address,
      amount: requestedAmount,
      assetId: requestedAssetId,
      asset: requestedAssetAlias,
    } = request.body ?? {};

    if (!address || !isAddress(address)) {
      return reply.status(400).send({
        error: 'Invalid address',
        message: 'Provide a valid Ethereum address in the request body: { "address": "0x..." }',
      });
    }

    const asset = getAssetConfig(
      typeof requestedAssetId === 'string'
        ? requestedAssetId
        : typeof requestedAssetAlias === 'string'
          ? requestedAssetAlias
          : undefined,
    );

    if (!asset) {
      return reply.status(400).send({
        error: 'Invalid asset',
        message: `Allowed assets: ${config.assets.map((item) => item.id).join(', ')}`,
      });
    }

    let dripAmount = asset.defaultAmount;
    if (requestedAmount) {
      const numeric = requestedAmount.replace(/[^0-9.]/g, '');
      if (isAllowedAmount(asset, numeric)) {
        dripAmount = numeric;
      } else {
        return reply.status(400).send({
          error: 'Invalid amount',
          message: `Allowed amounts for ${asset.symbol}: ${asset.allowedAmounts.map((value) => `${value} ${asset.symbol}`).join(', ')}`,
        });
      }
    }

    let availability;
    try {
      availability = getAssetAvailability(asset, await getAssetBalance(asset));
    } catch (error) {
      request.log.error(
        {
          assetId: asset.id,
          symbol: asset.symbol,
          err: error instanceof Error ? error.message : String(error),
        },
        '[faucet] Failed to verify asset funding before claim',
      );
      availability = getAssetAvailability(asset, 'unavailable');
    }

    if (!availability.claimableAmounts.includes(dripAmount)) {
      request.log.warn(
        {
          assetId: asset.id,
          symbol: asset.symbol,
          requestedAmount: dripAmount,
          minimumClaimAmount: availability.minimumClaimAmount,
          shortfall: availability.shortfall,
        },
        '[faucet] Rejecting claim for an underfunded asset',
      );
      return reply.status(503).send({
        error: 'Asset temporarily unavailable',
        message: `${asset.symbol} is temporarily unavailable because the faucet wallet is underfunded.`,
        assetId: asset.id,
        available: false,
        claimableAmounts: availability.claimableAmounts,
        minimumClaimAmount: availability.minimumClaimAmount,
        shortfall: availability.shortfall,
      });
    }

    const { allowed, retryAfterSeconds } = await checkCooldown(address, asset.id);
    if (!allowed) {
      const hours = Math.ceil(retryAfterSeconds / 3600);
      return reply.status(429).send({
        error: 'Rate limited',
        message: `Address ${address} already received ${asset.symbol}. Try again in ~${hours}h.`,
        retryAfterSeconds,
      });
    }

    try {
      const result = await drip(address as `0x${string}`, asset, dripAmount);

      await setCooldown(address, asset.id);

      return reply.send({
        success: true,
        txHash: result.txHash,
        amount: `${result.amount} ${result.symbol}`,
        recipient: address,
        cooldownHours: config.cooldownHours,
        assetId: result.assetId,
        symbol: result.symbol,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[faucet] Drip failed for ${address}:`, message);
      return reply.status(500).send({
        error: 'Drip failed',
        message: `Could not send ${asset.symbol}. The faucet wallet may not be configured, funded, or authorized for that asset.`,
      });
    }
  });
}

import type { FastifyInstance } from 'fastify';
import { isAddress } from 'viem';
import { drip } from '../services/wallet.js';
import { checkCooldown } from '../services/rateLimit.js';
import { config } from '../config.js';

interface DripBody {
  address: string;
}

export async function dripRoutes(app: FastifyInstance) {
  app.post<{ Body: DripBody }>('/drip', async (request, reply) => {
    const { address } = request.body ?? {};

    if (!address || !isAddress(address)) {
      return reply.status(400).send({
        error: 'Invalid address',
        message: 'Provide a valid Ethereum address in the request body: { "address": "0x..." }',
      });
    }

    // Check cooldown
    const { allowed, retryAfterSeconds } = await checkCooldown(address);
    if (!allowed) {
      const hours = Math.ceil(retryAfterSeconds / 3600);
      return reply.status(429).send({
        error: 'Rate limited',
        message: `Address ${address} already received tokens. Try again in ~${hours}h.`,
        retryAfterSeconds,
      });
    }

    try {
      const result = await drip(address as `0x${string}`);
      return reply.send({
        success: true,
        txHash: result.txHash,
        amount: `${result.amount} LITHO`,
        recipient: address,
        cooldownHours: config.cooldownHours,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[faucet] Drip failed for ${address}:`, message);
      return reply.status(500).send({
        error: 'Drip failed',
        message: 'Could not send tokens. The faucet wallet may be empty or the chain may be down.',
      });
    }
  });
}

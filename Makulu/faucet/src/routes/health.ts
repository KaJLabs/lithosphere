import type { FastifyInstance } from 'fastify';
import { getFaucetBalance, getFaucetAddress } from '../services/wallet.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    try {
      const balance = await getFaucetBalance();
      const address = getFaucetAddress();
      return reply.send({
        status: 'ok',
        service: 'lithosphere-faucet',
        faucetAddress: address,
        balance: `${balance} LITHO`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      return reply.status(503).send({ status: 'error', service: 'lithosphere-faucet' });
    }
  });
}

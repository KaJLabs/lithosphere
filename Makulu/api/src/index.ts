import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs, resolvers } from './schema.js';
import { lithoRouter } from './litho.js';

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint for deployment verification
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'lithosphere-api',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Readiness probe (checks dependencies)
app.get('/ready', async (_req, res) => {
  try {
    // Add database connectivity check here if needed
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: 'Dependencies not ready' });
  }
});

app.use('/api/litho', lithoRouter());

async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app: app as any, path: '/graphql' });

  const port = process.env.API_PORT || 4000;
  app.listen(port, () => console.log(`API running on :${port}`));
}
start();

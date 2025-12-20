import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs, resolvers } from './schema.js';
import { lithoRouter } from './litho.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/litho', lithoRouter());

async function start() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app: app as any, path: '/graphql' });

  const port = process.env.API_PORT || 4000;
  app.listen(port, () => console.log(`API running on :${port}`));
}
start();

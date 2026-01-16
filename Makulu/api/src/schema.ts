import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type Query {
    hello: String!
    lithoBalance(address: String!): String!
  }
`;

export const resolvers = {
  Query: {
    hello: () => "Hello from Litho API",
    lithoBalance: async (_: any, args: { address: string }) => {
      // TODO: fetch from indexer or RPC
      return "0";
    },
  },
};

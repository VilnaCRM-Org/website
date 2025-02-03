import { TypedDocumentNode, gql } from '@apollo/client';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { GraphQLResolveInfo } from 'graphql';

type User = {
  id: string;
  fullName: string;
  email: string;
  password: string;
};

type Mutation = {
  signUp: (parent: unknown, args: User, context: unknown, info: GraphQLResolveInfo) => string;
};

const typeDefs: TypedDocumentNode = gql`
  type User {
    id: ID!
    fullName: String!
    email: String!
    password: String!
  }

  type Mutation {
    signUp(fullName: String!, email: String!, password: String!): String!
  }
`;
const resolvers: { Mutation: Mutation } = {
  Mutation: {
    signUp: (_: unknown, { id}: User): string =>  `User registered successfully! ID: ${id}`
  },
};


const server:ApolloServer = new ApolloServer({ typeDefs, resolvers });

// Start the server with standalone server configuration
async function startServer():Promise<void> {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000, path: '/graphql' },
  });

  console.log(`🚀 Server ready at ${url}`);
}

startServer();

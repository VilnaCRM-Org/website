/* eslint-disable */
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const typeDefs = `#graphql
   type User {
    id: ID!
    fullName: String!
    email: String!
    password: String!
  }
`;

const resolvers = {
  Query: {
    signUp: async (_: any, { fullName }: { fullName: string }): Promise<string> => {
      try {
        return `You registered successfully! Welcome ${fullName}`;
      } catch (error) {
        throw new Error(`Failed to register user: ${error}`);
      }
    },
  },
};
const server= new ApolloServer({
  typeDefs,
  resolvers,
});
async function startServer():Promise<void> {
  try {
    const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
    console.log(`🚀 Server ready at ${url}`);
  } catch (error: unknown) {
    // @ts-ignore
    console.log(error.message);
    process.exit(1);
  }
}

startServer();


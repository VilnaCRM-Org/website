/* eslint-disable */
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
require('dotenv').config();

async function getRemoteSchema(){
  const response = await fetch(`${process.env.NEXT_PUBLIC_GRAPHQL_SCHEMA_ROW}` );

  if (!response.ok) {
    throw new Error(`Failed to fetch schema: ${response.statusText}`);
  }

  return await response.text();
}

const resolvers = {
  Mutation: {
    createUser: async (_: any, { input }: { input: any }) => {
      try {
        const newUser = {
          id: "1",
          confirmed: true,
          email: input.email,
          initials: input.initials,
        };

        return {
          user: newUser,
          clientMutationId: input.clientMutationId,
        };
      } catch (error) {
        throw new Error(`Failed to create user: ${error}`);
      }
    },
  },
};


async function startServer():Promise<void> {

  try {
    const typeDefs:string = await getRemoteSchema();
    const server = new ApolloServer({ typeDefs, resolvers });

    const { url } = await startStandaloneServer(server, { listen: { port: 4000, path:'/graphql' } });
    console.log(`🚀 Server ready at ${url}`);
  }catch (error:unknown) {
    console.log((error as Error).message);
    process.exit(1);
  }

}

startServer();


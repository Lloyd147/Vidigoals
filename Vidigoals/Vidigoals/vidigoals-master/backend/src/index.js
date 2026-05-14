const { GraphQLServer } = require('graphql-yoga');
const { loginToFPL } = require('../helpers/FPL');
const { prisma } = require('./generated/prisma-client');

const resolvers = {
  Query: {},
  Mutation: {
    login: async (_, args, context, info) => {
      const { login, password } = args;
      const response = await loginToFPL(login, password, context);
      return response;
    }
  }
};

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: request => ({
    ...request,
    prisma
  })
});

server.start(() => console.log('Server is running on http://localhost:4000'));

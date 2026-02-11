import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; username: string };
    user: { userId: string; username: string };
  }
}

export default fp(async (app) => {
  const config = getConfig();

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });
}, { name: 'auth' });

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

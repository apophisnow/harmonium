import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { getConfig } from '../config.js';

export default fp(async (app) => {
  const config = getConfig();

  await app.register(cors, {
    origin: config.CLIENT_URL,
    credentials: true,
  });
}, { name: 'cors' });

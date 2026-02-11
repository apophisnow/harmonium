import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { getConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (app) => {
  const config = getConfig();
  const redis = new Redis(config.REDIS_URL);

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
}, { name: 'redis' });

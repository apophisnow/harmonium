import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

export default fp(async (app) => {
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: app.redis,
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise fall back to IP.
      // request.user is set by @fastify/jwt after authentication.
      // For unauthenticated requests (login, register, etc.) it will be undefined.
      const user = (request as Record<string, any>).user as
        | { userId: string }
        | undefined;
      return user?.userId ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => {
      return {
        error: 'TooManyRequests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        statusCode: 429,
      };
    },
  });
}, { name: 'rate-limit', dependencies: ['redis'] });

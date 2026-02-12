import type { FastifyInstance } from 'fastify';
import { getConfig } from '../../config.js';

export async function configRoutes(app: FastifyInstance) {
  // GET /api/config - Public endpoint (no auth required)
  app.get('/api/config', { config: { rateLimit: false } }, async (_request, reply) => {
    const config = getConfig();
    return reply.send({
      defaultTheme: config.DEFAULT_THEME,
      defaultMode: config.DEFAULT_MODE,
    });
  });
}

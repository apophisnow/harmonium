import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../utils/errors.js';
import { searchQuerySchema } from './search.schemas.js';
import * as searchService from './search.service.js';

export async function searchRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/search/messages - Search messages
  app.get(
    '/api/search/messages',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '5 seconds',
        },
      },
    },
    async (request, reply) => {
      const queryParsed = searchQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new ValidationError(queryParsed.error.errors[0].message);
      }

      const result = await searchService.searchMessages(
        request.user.userId,
        queryParsed.data,
      );

      return reply.send(result);
    },
  );
}

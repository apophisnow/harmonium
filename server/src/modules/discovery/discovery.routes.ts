import type { FastifyInstance } from 'fastify';
import {
  discoveryQuerySchema,
  discoveryServerParamsSchema,
} from './discovery.schemas.js';
import * as discoveryService from './discovery.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function discoveryRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/discovery/servers - Browse discoverable servers
  app.get('/api/discovery/servers', async (request, reply) => {
    const parsed = discoveryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const result = await discoveryService.getDiscoverableServers(parsed.data);
    return reply.send(result);
  });

  // GET /api/discovery/servers/:serverId - Get a specific discoverable server
  app.get('/api/discovery/servers/:serverId', async (request, reply) => {
    const paramsParsed = discoveryServerParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const server = await discoveryService.getDiscoveryServer(paramsParsed.data.serverId);
    return reply.send(server);
  });
}

import type { FastifyInstance } from 'fastify';
import {
  createServerSchema,
  updateServerSchema,
  serverParamsSchema,
  memberParamsSchema,
} from './servers.schemas.js';
import * as serversService from './servers.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function serverRoutes(app: FastifyInstance) {
  // All routes in this plugin require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/servers - Create server
  app.post('/api/servers', async (request, reply) => {
    const parsed = createServerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const server = await serversService.createServer(request.user.userId, parsed.data);
    return reply.status(201).send(server);
  });

  // GET /api/servers - List user's servers
  app.get('/api/servers', async (request, reply) => {
    const servers = await serversService.getUserServers(request.user.userId);
    return reply.send(servers);
  });

  // GET /api/servers/:serverId - Get server details
  app.get('/api/servers/:serverId', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const server = await serversService.getServerById(
      paramsParsed.data.serverId,
      request.user.userId,
    );
    return reply.send(server);
  });

  // PATCH /api/servers/:serverId - Update server (owner only)
  app.patch('/api/servers/:serverId', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = updateServerSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const server = await serversService.updateServer(
      paramsParsed.data.serverId,
      request.user.userId,
      bodyParsed.data,
    );
    return reply.send(server);
  });

  // DELETE /api/servers/:serverId - Delete server (owner only)
  app.delete('/api/servers/:serverId', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await serversService.deleteServer(paramsParsed.data.serverId, request.user.userId);
    return reply.status(204).send();
  });

  // GET /api/servers/:serverId/members - List members
  app.get('/api/servers/:serverId/members', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const members = await serversService.getServerMembers(
      paramsParsed.data.serverId,
      request.user.userId,
    );
    return reply.send(members);
  });

  // DELETE /api/servers/:serverId/members/@me - Leave server
  app.delete('/api/servers/:serverId/members/@me', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await serversService.leaveServer(paramsParsed.data.serverId, request.user.userId);
    return reply.status(204).send();
  });

  // DELETE /api/servers/:serverId/members/:userId - Kick member
  app.delete('/api/servers/:serverId/members/:userId', async (request, reply) => {
    const paramsParsed = memberParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await serversService.kickMember(
      paramsParsed.data.serverId,
      request.user.userId,
      paramsParsed.data.userId,
    );
    return reply.status(204).send();
  });
}

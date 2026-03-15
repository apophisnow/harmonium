import type { FastifyInstance } from 'fastify';
import { banMemberSchema, banParamsSchema, serverParamsSchema } from './bans.schemas.js';
import * as bansService from './bans.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function banRoutes(app: FastifyInstance) {
  // All routes in this plugin require authentication
  app.addHook('preHandler', app.authenticate);

  // PUT /api/servers/:serverId/bans/:userId - Ban a member
  app.put('/api/servers/:serverId/bans/:userId', async (request, reply) => {
    const paramsParsed = banParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = banMemberSchema.safeParse(request.body ?? {});
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    await bansService.banMember(
      paramsParsed.data.serverId,
      request.user.userId,
      paramsParsed.data.userId,
      bodyParsed.data,
    );
    return reply.status(204).send();
  });

  // DELETE /api/servers/:serverId/bans/:userId - Unban a member
  app.delete('/api/servers/:serverId/bans/:userId', async (request, reply) => {
    const paramsParsed = banParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await bansService.unbanMember(
      paramsParsed.data.serverId,
      request.user.userId,
      paramsParsed.data.userId,
    );
    return reply.status(204).send();
  });

  // GET /api/servers/:serverId/bans - List bans
  app.get('/api/servers/:serverId/bans', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bans = await bansService.getBans(
      paramsParsed.data.serverId,
      request.user.userId,
    );
    return reply.send(bans);
  });
}

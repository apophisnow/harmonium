import type { FastifyInstance } from 'fastify';
import { Permission } from '@harmonium/shared';
import { requireChannelPermission } from '../../utils/permissions.js';
import { ValidationError } from '../../utils/errors.js';
import { channelParamsSchema, serverParamsSchema, markReadBodySchema } from './read-states.schemas.js';
import * as readStatesService from './read-states.service.js';

export async function readStateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // POST /api/channels/:channelId/read-state — mark channel as read
  app.post(
    '/api/channels/:channelId/read-state',
    {
      preHandler: [requireChannelPermission(Permission.READ_MESSAGES)],
    },
    async (request, reply) => {
      const paramsParsed = channelParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      const bodyParsed = markReadBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new ValidationError(bodyParsed.error.errors[0].message);
      }

      await readStatesService.markRead(
        request.user.userId,
        paramsParsed.data.channelId,
        bodyParsed.data.messageId,
      );

      return reply.status(204).send();
    },
  );

  // GET /api/servers/:serverId/read-states — get read states for all channels in a server
  app.get(
    '/api/servers/:serverId/read-states',
    async (request, reply) => {
      const paramsParsed = serverParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      const readStates = await readStatesService.getReadStates(
        request.user.userId,
        [BigInt(paramsParsed.data.serverId)],
      );

      return reply.send(readStates);
    },
  );
}

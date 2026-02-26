import type { FastifyInstance } from 'fastify';
import { Permission } from '@harmonium/shared';
import { requireChannelPermission } from '../../utils/permissions.js';
import { ValidationError } from '../../utils/errors.js';
import { reactionParamsSchema } from './reactions.schemas.js';
import * as reactionsService from './reactions.service.js';

export async function reactionRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // PUT /api/channels/:channelId/messages/:messageId/reactions/:emoji - Add reaction
  app.put(
    '/api/channels/:channelId/messages/:messageId/reactions/:emoji',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '5 seconds',
        },
      },
      preHandler: [requireChannelPermission(Permission.READ_MESSAGES)],
    },
    async (request, reply) => {
      const paramsParsed = reactionParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      const { channelId, messageId, emoji } = paramsParsed.data;
      await reactionsService.addReaction(channelId, messageId, request.user.userId, decodeURIComponent(emoji));

      return reply.status(204).send();
    },
  );

  // DELETE /api/channels/:channelId/messages/:messageId/reactions/:emoji - Remove reaction
  app.delete(
    '/api/channels/:channelId/messages/:messageId/reactions/:emoji',
    {
      preHandler: [requireChannelPermission(Permission.READ_MESSAGES)],
    },
    async (request, reply) => {
      const paramsParsed = reactionParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      const { channelId, messageId, emoji } = paramsParsed.data;
      await reactionsService.removeReaction(channelId, messageId, request.user.userId, decodeURIComponent(emoji));

      return reply.status(204).send();
    },
  );
}

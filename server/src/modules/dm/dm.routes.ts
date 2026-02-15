import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../utils/errors.js';
import {
  createDMChannelSchema,
  sendDMMessageSchema,
  dmChannelParamsSchema,
  dmMessageParamsSchema,
  dmMessagesQuerySchema,
} from './dm.schemas.js';
import * as dmService from './dm.service.js';

export async function dmRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/dm/channels - Create or get a DM channel
  app.post('/api/dm/channels', async (request, reply) => {
    const bodyParsed = createDMChannelSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const channel = await dmService.createOrGetDMChannel(
      request.user.userId,
      bodyParsed.data.recipientId,
    );

    return reply.status(200).send(channel);
  });

  // GET /api/dm/channels - List all DM channels for the user
  app.get('/api/dm/channels', async (request, reply) => {
    const channels = await dmService.getDMChannels(request.user.userId);
    return reply.send(channels);
  });

  // GET /api/dm/channels/:dmChannelId/messages - Get messages
  app.get('/api/dm/channels/:dmChannelId/messages', async (request, reply) => {
    const paramsParsed = dmChannelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const queryParsed = dmMessagesQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      throw new ValidationError(queryParsed.error.errors[0].message);
    }

    const messages = await dmService.getDMMessages(
      paramsParsed.data.dmChannelId,
      request.user.userId,
      queryParsed.data,
    );

    return reply.send(messages);
  });

  // POST /api/dm/channels/:dmChannelId/messages - Send a message
  app.post(
    '/api/dm/channels/:dmChannelId/messages',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '5 seconds',
        },
      },
    },
    async (request, reply) => {
      const paramsParsed = dmChannelParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      const bodyParsed = sendDMMessageSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new ValidationError(bodyParsed.error.errors[0].message);
      }

      const { message } = await dmService.createDMMessage(
        paramsParsed.data.dmChannelId,
        request.user.userId,
        bodyParsed.data,
      );

      return reply.status(201).send(message);
    },
  );

  // DELETE /api/dm/channels/:dmChannelId/messages/:messageId - Delete a message
  app.delete('/api/dm/channels/:dmChannelId/messages/:messageId', async (request, reply) => {
    const paramsParsed = dmMessageParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await dmService.deleteDMMessage(
      paramsParsed.data.dmChannelId,
      paramsParsed.data.messageId,
      request.user.userId,
    );

    return reply.status(204).send();
  });
}

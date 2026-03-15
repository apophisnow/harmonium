import type { FastifyInstance } from 'fastify';
import {
  createDmSchema,
  createGroupDmSchema,
  updateGroupDmSchema,
  dmChannelParamsSchema,
  dmMemberParamsSchema,
} from './dm.schemas.js';
import * as dmService from './dm.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function dmRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/dm/channels - Create 1:1 DM
  app.post('/api/dm/channels', async (request, reply) => {
    const bodyParsed = createDmSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const channel = await dmService.createDm(
      request.user.userId,
      bodyParsed.data.recipientId,
    );
    return reply.status(201).send(channel);
  });

  // POST /api/dm/channels/group - Create group DM
  app.post('/api/dm/channels/group', async (request, reply) => {
    const bodyParsed = createGroupDmSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const channel = await dmService.createGroupDm(
      request.user.userId,
      bodyParsed.data.recipientIds,
      bodyParsed.data.name,
    );
    return reply.status(201).send(channel);
  });

  // GET /api/dm/channels - List user's open DM channels
  app.get('/api/dm/channels', async (request, reply) => {
    const channels = await dmService.getDmChannels(request.user.userId);
    return reply.send(channels);
  });

  // DELETE /api/dm/channels/:channelId - Close DM (hide from list)
  app.delete('/api/dm/channels/:channelId', async (request, reply) => {
    const paramsParsed = dmChannelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await dmService.closeDm(request.user.userId, paramsParsed.data.channelId);
    return reply.status(204).send();
  });

  // PUT /api/dm/channels/:channelId/members/:userId - Add member to group DM
  app.put('/api/dm/channels/:channelId/members/:userId', async (request, reply) => {
    const paramsParsed = dmMemberParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const channel = await dmService.addGroupDmMember(
      paramsParsed.data.channelId,
      request.user.userId,
      paramsParsed.data.userId,
    );
    return reply.send(channel);
  });

  // DELETE /api/dm/channels/:channelId/members/@me - Leave group DM
  app.delete('/api/dm/channels/:channelId/members/@me', async (request, reply) => {
    const paramsParsed = dmChannelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await dmService.leaveGroupDm(paramsParsed.data.channelId, request.user.userId);
    return reply.status(204).send();
  });

  // PATCH /api/dm/channels/:channelId - Update group DM (name, icon)
  app.patch('/api/dm/channels/:channelId', async (request, reply) => {
    const paramsParsed = dmChannelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = updateGroupDmSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const channel = await dmService.updateGroupDm(
      paramsParsed.data.channelId,
      request.user.userId,
      bodyParsed.data.name,
    );
    return reply.send(channel);
  });
}

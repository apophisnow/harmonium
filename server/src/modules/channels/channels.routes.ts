import type { FastifyInstance } from 'fastify';
import {
  createChannelSchema,
  updateChannelSchema,
  createCategorySchema,
  updateCategorySchema,
  permissionOverrideSchema,
  serverParamsSchema,
  channelParamsSchema,
  categoryParamsSchema,
  permissionTargetParamsSchema,
} from './channels.schemas.js';
import * as channelsService from './channels.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function channelRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // ===== Server-scoped routes: /api/servers/:serverId =====

  // POST /api/servers/:serverId/channels - Create channel (MANAGE_CHANNELS)
  app.post('/api/servers/:serverId/channels', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = createChannelSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const channel = await channelsService.createChannel(
      paramsParsed.data.serverId,
      request.user.userId,
      bodyParsed.data,
    );
    return reply.status(201).send(channel);
  });

  // GET /api/servers/:serverId/channels - List channels (membership required)
  app.get('/api/servers/:serverId/channels', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const channels = await channelsService.getServerChannels(
      paramsParsed.data.serverId,
      request.user.userId,
    );
    return reply.send(channels);
  });

  // POST /api/servers/:serverId/categories - Create category (MANAGE_CHANNELS)
  app.post('/api/servers/:serverId/categories', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = createCategorySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const category = await channelsService.createCategory(
      paramsParsed.data.serverId,
      request.user.userId,
      bodyParsed.data,
    );
    return reply.status(201).send(category);
  });

  // ===== Channel-scoped routes: /api/channels =====

  // PATCH /api/channels/:channelId - Update channel (MANAGE_CHANNELS)
  app.patch('/api/channels/:channelId', async (request, reply) => {
    const paramsParsed = channelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = updateChannelSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const channel = await channelsService.updateChannel(
      paramsParsed.data.channelId,
      request.user.userId,
      bodyParsed.data,
    );
    return reply.send(channel);
  });

  // DELETE /api/channels/:channelId - Delete channel (MANAGE_CHANNELS)
  app.delete('/api/channels/:channelId', async (request, reply) => {
    const paramsParsed = channelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await channelsService.deleteChannel(
      paramsParsed.data.channelId,
      request.user.userId,
    );
    return reply.status(204).send();
  });

  // GET /api/channels/:channelId/permissions - Get permission overrides
  app.get('/api/channels/:channelId/permissions', async (request, reply) => {
    const paramsParsed = channelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const overrides = await channelsService.getChannelPermissionOverrides(
      paramsParsed.data.channelId,
      request.user.userId,
    );
    return reply.send(overrides);
  });

  // PUT /api/channels/:channelId/permissions - Set permission override (MANAGE_ROLES)
  app.put('/api/channels/:channelId/permissions', async (request, reply) => {
    const paramsParsed = channelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = permissionOverrideSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const override = await channelsService.setPermissionOverride(
      paramsParsed.data.channelId,
      request.user.userId,
      bodyParsed.data,
    );
    return reply.send(override);
  });

  // DELETE /api/channels/:channelId/permissions/:targetType/:targetId - Delete permission override (MANAGE_ROLES)
  app.delete('/api/channels/:channelId/permissions/:targetType/:targetId', async (request, reply) => {
    const paramsParsed = permissionTargetParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await channelsService.deletePermissionOverride(
      paramsParsed.data.channelId,
      paramsParsed.data.targetType,
      paramsParsed.data.targetId,
      request.user.userId,
    );
    return reply.status(204).send();
  });

  // ===== Category-scoped routes: /api/categories =====

  // PATCH /api/categories/:categoryId - Update category (MANAGE_CHANNELS)
  app.patch('/api/categories/:categoryId', async (request, reply) => {
    const paramsParsed = categoryParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = updateCategorySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const category = await channelsService.updateCategory(
      paramsParsed.data.categoryId,
      request.user.userId,
      bodyParsed.data,
    );
    return reply.send(category);
  });

  // DELETE /api/categories/:categoryId - Delete category (MANAGE_CHANNELS)
  app.delete('/api/categories/:categoryId', async (request, reply) => {
    const paramsParsed = categoryParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await channelsService.deleteCategory(
      paramsParsed.data.categoryId,
      request.user.userId,
    );
    return reply.status(204).send();
  });
}

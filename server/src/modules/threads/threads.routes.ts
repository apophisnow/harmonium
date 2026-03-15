import type { FastifyInstance } from 'fastify';
import {
  createThreadSchema,
  channelParamsSchema,
  threadParamsSchema,
} from './threads.schemas.js';
import * as threadsService from './threads.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function threadRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/channels/:channelId/threads - Create thread from a message
  app.post('/api/channels/:channelId/threads', async (request, reply) => {
    const paramsParsed = channelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = createThreadSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const thread = await threadsService.createThread(
      paramsParsed.data.channelId,
      request.user.userId,
      bodyParsed.data,
    );
    return reply.status(201).send(thread);
  });

  // GET /api/channels/:channelId/threads - List threads in a channel
  app.get('/api/channels/:channelId/threads', async (request, reply) => {
    const paramsParsed = channelParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const threads = await threadsService.getThreads(
      paramsParsed.data.channelId,
      request.user.userId,
    );
    return reply.send(threads);
  });

  // GET /api/threads/:threadId - Get thread details
  app.get('/api/threads/:threadId', async (request, reply) => {
    const paramsParsed = threadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const thread = await threadsService.getThread(
      paramsParsed.data.threadId,
      request.user.userId,
    );
    return reply.send(thread);
  });

  // POST /api/threads/:threadId/archive - Archive a thread
  app.post('/api/threads/:threadId/archive', async (request, reply) => {
    const paramsParsed = threadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const thread = await threadsService.archiveThread(
      paramsParsed.data.threadId,
      request.user.userId,
    );
    return reply.send(thread);
  });

  // POST /api/threads/:threadId/unarchive - Unarchive a thread
  app.post('/api/threads/:threadId/unarchive', async (request, reply) => {
    const paramsParsed = threadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const thread = await threadsService.unarchiveThread(
      paramsParsed.data.threadId,
      request.user.userId,
    );
    return reply.send(thread);
  });

  // POST /api/threads/:threadId/join - Join a thread
  app.post('/api/threads/:threadId/join', async (request, reply) => {
    const paramsParsed = threadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await threadsService.joinThread(
      paramsParsed.data.threadId,
      request.user.userId,
    );
    return reply.status(204).send();
  });

  // POST /api/threads/:threadId/leave - Leave a thread
  app.post('/api/threads/:threadId/leave', async (request, reply) => {
    const paramsParsed = threadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await threadsService.leaveThread(
      paramsParsed.data.threadId,
      request.user.userId,
    );
    return reply.status(204).send();
  });

  // DELETE /api/threads/:threadId - Delete a thread
  app.delete('/api/threads/:threadId', async (request, reply) => {
    const paramsParsed = threadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await threadsService.deleteThread(
      paramsParsed.data.threadId,
      request.user.userId,
    );
    return reply.status(204).send();
  });
}

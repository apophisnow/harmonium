import type { FastifyInstance } from 'fastify';
import {
  sendFriendRequestSchema,
  userIdParamsSchema,
} from './relationships.schemas.js';
import * as relationshipsService from './relationships.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function relationshipRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/relationships — list all relationships
  app.get('/api/relationships', async (request, reply) => {
    const relationships = await relationshipsService.getRelationships(request.user.userId);
    return reply.send(relationships);
  });

  // POST /api/relationships/friends — send friend request (by username#discriminator)
  app.post('/api/relationships/friends', async (request, reply) => {
    const bodyParsed = sendFriendRequestSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    await relationshipsService.sendFriendRequest(
      request.user.userId,
      bodyParsed.data.username,
      bodyParsed.data.discriminator,
    );
    return reply.status(204).send();
  });

  // PUT /api/relationships/friends/:userId — accept friend request
  app.put('/api/relationships/friends/:userId', async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await relationshipsService.acceptFriendRequest(
      request.user.userId,
      paramsParsed.data.userId,
    );
    return reply.status(204).send();
  });

  // DELETE /api/relationships/friends/:userId — remove friend or decline request
  app.delete('/api/relationships/friends/:userId', async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const targetId = paramsParsed.data.userId;
    const userId = request.user.userId;

    // Try to decline/cancel a pending request first, then try removing a friend
    try {
      await relationshipsService.declineFriendRequest(userId, targetId);
    } catch {
      await relationshipsService.removeFriend(userId, targetId);
    }

    return reply.status(204).send();
  });

  // PUT /api/relationships/blocks/:userId — block user
  app.put('/api/relationships/blocks/:userId', async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await relationshipsService.blockUser(
      request.user.userId,
      paramsParsed.data.userId,
    );
    return reply.status(204).send();
  });

  // DELETE /api/relationships/blocks/:userId — unblock user
  app.delete('/api/relationships/blocks/:userId', async (request, reply) => {
    const paramsParsed = userIdParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await relationshipsService.unblockUser(
      request.user.userId,
      paramsParsed.data.userId,
    );
    return reply.status(204).send();
  });
}

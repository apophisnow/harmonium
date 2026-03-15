import type { FastifyInstance } from 'fastify';
import { ValidationError, ForbiddenError } from '../../utils/errors.js';
import {
  createWebhookSchema,
  updateWebhookSchema,
  executeWebhookSchema,
  serverParamsSchema,
  webhookParamsSchema,
  executeWebhookParamsSchema,
} from './webhooks.schemas.js';
import * as webhooksService from './webhooks.service.js';
import { getDb, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Webhook management routes (authenticated) + execute endpoint (token-authenticated).
 */
export async function webhookRoutes(app: FastifyInstance) {
  // === Authenticated CRUD routes ===

  // POST /api/servers/:serverId/webhooks - Create webhook
  app.post('/api/servers/:serverId/webhooks', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = createWebhookSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    // Verify membership
    const db = getDb();
    const membership = await db.query.serverMembers.findFirst({
      where: and(
        eq(schema.serverMembers.serverId, BigInt(paramsParsed.data.serverId)),
        eq(schema.serverMembers.userId, BigInt(request.user.userId)),
      ),
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    const webhook = await webhooksService.createWebhook(
      paramsParsed.data.serverId,
      request.user.userId,
      bodyParsed.data,
    );

    return reply.status(201).send(webhook);
  });

  // GET /api/servers/:serverId/webhooks - List webhooks
  app.get('/api/servers/:serverId/webhooks', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    // Verify membership
    const db = getDb();
    const membership = await db.query.serverMembers.findFirst({
      where: and(
        eq(schema.serverMembers.serverId, BigInt(paramsParsed.data.serverId)),
        eq(schema.serverMembers.userId, BigInt(request.user.userId)),
      ),
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    const webhooks = await webhooksService.getWebhooks(
      paramsParsed.data.serverId,
      request.user.userId,
    );

    return reply.send(webhooks);
  });

  // PATCH /api/servers/:serverId/webhooks/:webhookId - Update webhook
  app.patch('/api/servers/:serverId/webhooks/:webhookId', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const paramsParsed = webhookParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = updateWebhookSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    // Verify membership
    const db = getDb();
    const membership = await db.query.serverMembers.findFirst({
      where: and(
        eq(schema.serverMembers.serverId, BigInt(paramsParsed.data.serverId)),
        eq(schema.serverMembers.userId, BigInt(request.user.userId)),
      ),
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    const webhook = await webhooksService.updateWebhook(
      paramsParsed.data.serverId,
      paramsParsed.data.webhookId,
      request.user.userId,
      bodyParsed.data,
    );

    return reply.send(webhook);
  });

  // DELETE /api/servers/:serverId/webhooks/:webhookId - Delete webhook
  app.delete('/api/servers/:serverId/webhooks/:webhookId', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const paramsParsed = webhookParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    // Verify membership
    const db = getDb();
    const membership = await db.query.serverMembers.findFirst({
      where: and(
        eq(schema.serverMembers.serverId, BigInt(paramsParsed.data.serverId)),
        eq(schema.serverMembers.userId, BigInt(request.user.userId)),
      ),
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    await webhooksService.deleteWebhook(
      paramsParsed.data.serverId,
      paramsParsed.data.webhookId,
      request.user.userId,
    );

    return reply.status(204).send();
  });

  // === Execute endpoint (no JWT auth, authenticated by token in URL) ===

  // POST /api/webhooks/:webhookId/:token - Execute webhook
  app.post('/api/webhooks/:webhookId/:token', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '5 seconds',
      },
    },
  }, async (request, reply) => {
    const paramsParsed = executeWebhookParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = executeWebhookSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const message = await webhooksService.executeWebhook(
      paramsParsed.data.webhookId,
      paramsParsed.data.token,
      bodyParsed.data,
    );

    return reply.status(201).send(message);
  });
}

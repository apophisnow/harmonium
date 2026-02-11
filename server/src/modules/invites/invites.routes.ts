import type { FastifyInstance } from 'fastify';
import {
  createInviteSchema,
  inviteParamsSchema,
  serverParamsSchema,
} from './invites.schemas.js';
import * as invitesService from './invites.service.js';
import { ValidationError, ForbiddenError } from '../../utils/errors.js';
import { hasPermission, Permission } from '@harmonium/shared';
import { getDb, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Server-scoped invite routes: /api/servers/:serverId/invites
 * All routes require authentication and server membership.
 */
export async function serverInviteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // POST /api/servers/:serverId/invites - Create invite (requires CREATE_INVITE permission)
  app.post('/api/servers/:serverId/invites', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = createInviteSchema.safeParse(request.body ?? {});
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const { serverId } = paramsParsed.data;
    const userId = request.user.userId;

    // Verify membership
    const db = getDb();
    const membership = await db.query.serverMembers.findFirst({
      where: and(
        eq(schema.serverMembers.serverId, BigInt(serverId)),
        eq(schema.serverMembers.userId, BigInt(userId)),
      ),
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    // Check CREATE_INVITE permission
    const permissions = await invitesService.getUserServerPermissions(
      BigInt(serverId),
      BigInt(userId),
    );
    if (!hasPermission(permissions, Permission.CREATE_INVITE)) {
      throw new ForbiddenError('You do not have permission to create invites');
    }

    const invite = await invitesService.createInvite(serverId, userId, bodyParsed.data);
    return reply.status(201).send(invite);
  });

  // GET /api/servers/:serverId/invites - List server invites (requires MANAGE_SERVER permission)
  app.get('/api/servers/:serverId/invites', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const { serverId } = paramsParsed.data;
    const userId = request.user.userId;

    // Verify membership
    const db = getDb();
    const membership = await db.query.serverMembers.findFirst({
      where: and(
        eq(schema.serverMembers.serverId, BigInt(serverId)),
        eq(schema.serverMembers.userId, BigInt(userId)),
      ),
    });

    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    // Check MANAGE_SERVER permission
    const permissions = await invitesService.getUserServerPermissions(
      BigInt(serverId),
      BigInt(userId),
    );
    if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
      throw new ForbiddenError('You do not have permission to manage invites');
    }

    const invites = await invitesService.getServerInvites(serverId);
    return reply.send(invites);
  });
}

/**
 * Invite-scoped routes: /api/invites
 * GET /:code is public (no auth), POST /:code/accept requires auth, DELETE /:code requires auth.
 */
export async function inviteRoutes(app: FastifyInstance) {
  // GET /api/invites/:code - Get invite info (public, no auth required)
  app.get('/api/invites/:code', async (request, reply) => {
    const paramsParsed = inviteParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const invite = await invitesService.getInviteInfo(paramsParsed.data.code);
    return reply.send(invite);
  });

  // POST /api/invites/:code/accept - Accept invite (auth required)
  app.post('/api/invites/:code/accept', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const paramsParsed = inviteParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const result = await invitesService.acceptInvite(
      paramsParsed.data.code,
      request.user.userId,
    );
    return reply.send(result);
  });

  // DELETE /api/invites/:code - Delete invite (auth required, creator or MANAGE_SERVER)
  app.delete('/api/invites/:code', {
    preHandler: app.authenticate,
  }, async (request, reply) => {
    const paramsParsed = inviteParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    // We need the serverId to check permissions. Look up the invite first.
    const db = getDb();
    const invite = await db.query.invites.findFirst({
      where: eq(schema.invites.code, paramsParsed.data.code),
    });

    if (!invite) {
      // Let service layer handle the 404 consistently
      await invitesService.deleteInvite(paramsParsed.data.code, request.user.userId, '0');
      return;
    }

    await invitesService.deleteInvite(
      paramsParsed.data.code,
      request.user.userId,
      invite.serverId.toString(),
    );
    return reply.status(204).send();
  });
}

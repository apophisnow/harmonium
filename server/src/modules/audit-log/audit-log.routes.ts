import type { FastifyInstance } from 'fastify';
import { auditLogParamsSchema, auditLogQuerySchema } from './audit-log.schemas.js';
import * as auditLogService from './audit-log.service.js';
import { ValidationError, ForbiddenError } from '../../utils/errors.js';
import { hasPermission, Permission } from '@harmonium/shared';
import { getDb, schema } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';
import { getUserServerPermissions } from '../invites/invites.service.js';

export async function auditLogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/servers/:serverId/audit-log
  app.get('/api/servers/:serverId/audit-log', async (request, reply) => {
    const paramsParsed = auditLogParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const queryParsed = auditLogQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      throw new ValidationError(queryParsed.error.errors[0].message);
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
    const permissions = await getUserServerPermissions(BigInt(serverId), BigInt(userId));
    if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
      throw new ForbiddenError('You do not have permission to view the audit log');
    }

    const entries = await auditLogService.getAuditLog(serverId, queryParsed.data);
    return reply.send(entries);
  });
}

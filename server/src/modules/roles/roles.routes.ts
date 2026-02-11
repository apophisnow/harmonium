import type { FastifyInstance } from 'fastify';
import { Permission } from '@harmonium/shared';
import {
  createRoleSchema,
  updateRoleSchema,
  reorderRolesSchema,
  roleParamsSchema,
  serverParamsSchema,
  roleMemberParamsSchema,
} from './roles.schemas.js';
import * as rolesService from './roles.service.js';
import { requirePermission } from '../../utils/permissions.js';
import { ValidationError } from '../../utils/errors.js';

export async function roleRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/servers/:serverId/roles - Create role (MANAGE_ROLES)
  app.post('/api/servers/:serverId/roles', {
    preHandler: [requirePermission(Permission.MANAGE_ROLES)],
  }, async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = createRoleSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const role = await rolesService.createRole(paramsParsed.data.serverId, bodyParsed.data);
    return reply.status(201).send(role);
  });

  // GET /api/servers/:serverId/roles - List server roles (membership required)
  app.get('/api/servers/:serverId/roles', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const roles = await rolesService.getServerRoles(paramsParsed.data.serverId);
    return reply.send(roles);
  });

  // PATCH /api/servers/:serverId/roles/reorder - Reorder roles (MANAGE_ROLES)
  app.patch('/api/servers/:serverId/roles/reorder', {
    preHandler: [requirePermission(Permission.MANAGE_ROLES)],
  }, async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = reorderRolesSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const roles = await rolesService.reorderRoles(
      paramsParsed.data.serverId,
      bodyParsed.data.roles,
    );
    return reply.send(roles);
  });

  // PATCH /api/servers/:serverId/roles/:roleId - Update role (MANAGE_ROLES)
  app.patch('/api/servers/:serverId/roles/:roleId', {
    preHandler: [requirePermission(Permission.MANAGE_ROLES)],
  }, async (request, reply) => {
    const paramsParsed = roleParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = updateRoleSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const role = await rolesService.updateRole(
      paramsParsed.data.serverId,
      paramsParsed.data.roleId,
      bodyParsed.data,
      request.user.userId,
    );
    return reply.send(role);
  });

  // DELETE /api/servers/:serverId/roles/:roleId - Delete role (MANAGE_ROLES)
  app.delete('/api/servers/:serverId/roles/:roleId', {
    preHandler: [requirePermission(Permission.MANAGE_ROLES)],
  }, async (request, reply) => {
    const paramsParsed = roleParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await rolesService.deleteRole(paramsParsed.data.serverId, paramsParsed.data.roleId);
    return reply.status(204).send();
  });

  // PUT /api/servers/:serverId/roles/:roleId/members/:userId - Assign role (MANAGE_ROLES)
  app.put('/api/servers/:serverId/roles/:roleId/members/:userId', {
    preHandler: [requirePermission(Permission.MANAGE_ROLES)],
  }, async (request, reply) => {
    const paramsParsed = roleMemberParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const role = await rolesService.assignRole(
      paramsParsed.data.serverId,
      paramsParsed.data.roleId,
      paramsParsed.data.userId,
      request.user.userId,
    );
    return reply.send(role);
  });

  // DELETE /api/servers/:serverId/roles/:roleId/members/:userId - Remove role (MANAGE_ROLES)
  app.delete('/api/servers/:serverId/roles/:roleId/members/:userId', {
    preHandler: [requirePermission(Permission.MANAGE_ROLES)],
  }, async (request, reply) => {
    const paramsParsed = roleMemberParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await rolesService.removeRole(
      paramsParsed.data.serverId,
      paramsParsed.data.roleId,
      paramsParsed.data.userId,
      request.user.userId,
    );
    return reply.status(204).send();
  });
}

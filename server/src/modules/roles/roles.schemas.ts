import { z } from 'zod';
import { safeLine, snowflakeId } from '../../utils/validation.js';

export const createRoleSchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Role name must be at least 1 character')
      .max(100, 'Role name must be at most 100 characters'),
  ),
  color: z.number().int().optional(),
  permissions: z
    .string()
    .regex(/^\d+$/, 'Invalid permissions value')
    .optional()
    .describe('Bigint permissions value as a string'),
});

export const updateRoleSchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Role name must be at least 1 character')
      .max(100, 'Role name must be at most 100 characters'),
  ).optional(),
  color: z.number().int().nullable().optional(),
  permissions: z
    .string()
    .regex(/^\d+$/, 'Invalid permissions value')
    .optional()
    .describe('Bigint permissions value as a string'),
  position: z.number().int().optional(),
});

export const roleParamsSchema = z.object({
  serverId: snowflakeId,
  roleId: snowflakeId,
});

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export const roleMemberParamsSchema = z.object({
  serverId: snowflakeId,
  roleId: snowflakeId,
  userId: snowflakeId,
});

export const reorderRolesSchema = z.object({
  roles: z.array(z.object({
    id: snowflakeId,
    position: z.number().int().min(0),
  })).min(1),
});

export type ReorderRolesInput = z.infer<typeof reorderRolesSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleParams = z.infer<typeof roleParamsSchema>;
export type RoleMemberParams = z.infer<typeof roleMemberParamsSchema>;

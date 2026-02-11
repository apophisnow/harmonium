import { z } from 'zod';
import { safeLine, safeText, snowflakeId } from '../../utils/validation.js';

export const createChannelSchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Channel name must be at least 1 character')
      .max(100, 'Channel name must be at most 100 characters'),
  ),
  type: z.enum(['text', 'voice']).default('text'),
  categoryId: snowflakeId.optional(),
  isPrivate: z.boolean().optional().default(false),
});

export const updateChannelSchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Channel name must be at least 1 character')
      .max(100, 'Channel name must be at most 100 characters'),
  ).optional(),
  topic: safeText(z.string().max(1024, 'Topic must be at most 1024 characters')).nullable().optional(),
  position: z.number().int().min(0).optional(),
  categoryId: snowflakeId.nullable().optional(),
});

export const createCategorySchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Category name must be at least 1 character')
      .max(100, 'Category name must be at most 100 characters'),
  ),
});

export const updateCategorySchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Category name must be at least 1 character')
      .max(100, 'Category name must be at most 100 characters'),
  ).optional(),
  position: z.number().int().min(0).optional(),
});

export const permissionOverrideSchema = z.object({
  targetType: z.enum(['role', 'member']),
  targetId: snowflakeId,
  allow: z.string().regex(/^\d+$/, 'Invalid permissions value'),
  deny: z.string().regex(/^\d+$/, 'Invalid permissions value'),
});

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export const channelParamsSchema = z.object({
  channelId: snowflakeId,
});

export const categoryParamsSchema = z.object({
  categoryId: snowflakeId,
});

export const permissionTargetParamsSchema = z.object({
  channelId: snowflakeId,
  targetType: z.enum(['role', 'member']),
  targetId: snowflakeId,
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type PermissionOverrideInput = z.infer<typeof permissionOverrideSchema>;

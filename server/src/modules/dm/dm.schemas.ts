import { z } from 'zod';
import { snowflakeId, safeText } from '../../utils/validation.js';

export const createDmSchema = z.object({
  recipientId: snowflakeId,
});

export const createGroupDmSchema = z.object({
  name: safeText(z.string().min(1).max(100)).optional(),
  recipientIds: z.array(snowflakeId).min(1).max(9),
});

export const updateGroupDmSchema = z.object({
  name: safeText(z.string().min(1).max(100)).optional(),
});

export const dmChannelParamsSchema = z.object({
  channelId: snowflakeId,
});

export const dmMemberParamsSchema = z.object({
  channelId: snowflakeId,
  userId: snowflakeId,
});

export type CreateDmInput = z.infer<typeof createDmSchema>;
export type CreateGroupDmInput = z.infer<typeof createGroupDmSchema>;
export type UpdateGroupDmInput = z.infer<typeof updateGroupDmSchema>;

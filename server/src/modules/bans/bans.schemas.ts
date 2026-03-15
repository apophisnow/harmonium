import { z } from 'zod';
import { safeText, snowflakeId } from '../../utils/validation.js';

export const banMemberSchema = z.object({
  reason: safeText(z.string().max(512, 'Reason must be at most 512 characters')).optional(),
  purgeMessages: z.boolean().optional().default(false),
});

export const banParamsSchema = z.object({
  serverId: snowflakeId,
  userId: snowflakeId,
});

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export type BanMemberInput = z.infer<typeof banMemberSchema>;

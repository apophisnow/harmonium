import { z } from 'zod';
import { snowflakeId } from '../../utils/validation.js';

export const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).optional(),
  expiresIn: z.number().int().min(1).optional(), // seconds
});

export const inviteParamsSchema = z.object({
  code: z.string().min(1, 'Invite code is required').regex(/^[a-zA-Z0-9]+$/, 'Invalid invite code'),
});

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export const serverInviteParamsSchema = z.object({
  serverId: snowflakeId,
  code: z.string().min(1, 'Invite code is required').regex(/^[a-zA-Z0-9]+$/, 'Invalid invite code'),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type InviteParams = z.infer<typeof inviteParamsSchema>;

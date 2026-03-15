import { z } from 'zod';
import { snowflakeId } from '../../utils/validation.js';

export const sendFriendRequestSchema = z.object({
  username: z.string().min(1),
  discriminator: z.string().min(4).max(4),
});

export const userIdParamsSchema = z.object({
  userId: snowflakeId,
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;

import { z } from 'zod';
import { snowflakeId } from '../../utils/validation.js';

export const reactionParamsSchema = z.object({
  channelId: snowflakeId,
  messageId: snowflakeId,
  emoji: z.string().min(1).max(32),
});

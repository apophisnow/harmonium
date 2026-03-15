import { z } from 'zod';
import { safeLine, snowflakeId } from '../../utils/validation.js';

export const createThreadSchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Thread name must be at least 1 character')
      .max(100, 'Thread name must be at most 100 characters'),
  ),
  messageId: snowflakeId,
});

export const channelParamsSchema = z.object({
  channelId: snowflakeId,
});

export const threadParamsSchema = z.object({
  threadId: snowflakeId,
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;

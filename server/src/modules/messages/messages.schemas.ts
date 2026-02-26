import { z } from 'zod';
import { safeText, snowflakeId } from '../../utils/validation.js';

export const createMessageSchema = z.object({
  content: safeText(
    z
      .string()
      .min(1, 'Message content must be at least 1 character')
      .max(4000, 'Message content must be at most 4000 characters'),
  ).optional(),
  replyToId: snowflakeId.optional(),
});

export const updateMessageSchema = z.object({
  content: safeText(
    z
      .string()
      .min(1, 'Message content must be at least 1 character')
      .max(4000, 'Message content must be at most 4000 characters'),
  ),
});

export const messagesQuerySchema = z.object({
  before: snowflakeId.optional(),
  after: snowflakeId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const channelParamsSchema = z.object({
  channelId: snowflakeId,
});

export const messageParamsSchema = z.object({
  channelId: snowflakeId,
  messageId: snowflakeId,
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

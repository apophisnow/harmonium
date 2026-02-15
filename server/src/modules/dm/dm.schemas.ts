import { z } from 'zod';
import { snowflakeId, safeText } from '../../utils/validation.js';

export const createDMChannelSchema = z.object({
  recipientId: snowflakeId,
});

export const sendDMMessageSchema = z.object({
  content: safeText(
    z.string().min(1, 'Message must be at least 1 character').max(4000, 'Message must be at most 4000 characters'),
  ),
});

export const dmChannelParamsSchema = z.object({
  dmChannelId: snowflakeId,
});

export const dmMessageParamsSchema = z.object({
  dmChannelId: snowflakeId,
  messageId: snowflakeId,
});

export const dmMessagesQuerySchema = z.object({
  before: snowflakeId.optional(),
  after: snowflakeId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateDMChannel = z.infer<typeof createDMChannelSchema>;
export type SendDMMessage = z.infer<typeof sendDMMessageSchema>;
export type DMMessagesQuery = z.infer<typeof dmMessagesQuerySchema>;

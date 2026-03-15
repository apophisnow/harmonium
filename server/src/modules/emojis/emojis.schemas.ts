import { z } from 'zod';
import { snowflakeId } from '../../utils/validation.js';

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export const emojiParamsSchema = z.object({
  serverId: snowflakeId,
  emojiId: snowflakeId,
});

export const createEmojiSchema = z.object({
  name: z.string()
    .min(2, 'Emoji name must be at least 2 characters')
    .max(32, 'Emoji name must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Emoji name can only contain alphanumeric characters and underscores'),
});

export const renameEmojiSchema = z.object({
  name: z.string()
    .min(2, 'Emoji name must be at least 2 characters')
    .max(32, 'Emoji name must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Emoji name can only contain alphanumeric characters and underscores'),
});

export type CreateEmojiInput = z.infer<typeof createEmojiSchema>;
export type RenameEmojiInput = z.infer<typeof renameEmojiSchema>;

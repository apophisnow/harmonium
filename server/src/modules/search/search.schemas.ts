import { z } from 'zod';
import { snowflakeId } from '../../utils/validation.js';

export const searchQuerySchema = z.object({
  query: z.string().min(1).max(200),
  serverId: snowflakeId.optional(),
  channelId: snowflakeId.optional(),
  authorId: snowflakeId.optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

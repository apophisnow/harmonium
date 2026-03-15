import { z } from 'zod';
import { safeLine, safeText, snowflakeId } from '../../utils/validation.js';

export const discoveryQuerySchema = z.object({
  search: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  sort: z.enum(['member_count', 'newest']).optional().default('member_count'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
});

export const updateDiscoverySchema = z.object({
  isDiscoverable: z.boolean().optional(),
  description: z.union([safeText(z.string().max(1000, 'Description must be at most 1000 characters')), z.null()]).optional(),
  category: z.union([safeLine(z.string().max(50)), z.null()]).optional(),
  vanityUrl: z.union([safeLine(z.string().max(32).regex(/^[a-zA-Z0-9-]+$/, 'Vanity URL may only contain letters, numbers, and hyphens')), z.null()]).optional(),
  bannerUrl: z.union([z.string().url('Invalid banner URL').max(512), z.null()]).optional(),
  primaryLanguage: safeLine(z.string().max(10)).optional(),
});

export const discoveryServerParamsSchema = z.object({
  serverId: snowflakeId,
});

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;
export type UpdateDiscoveryInput = z.infer<typeof updateDiscoverySchema>;

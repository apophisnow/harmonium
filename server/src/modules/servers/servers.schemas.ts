import { z } from 'zod';
import { safeLine, snowflakeId } from '../../utils/validation.js';

export const createServerSchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Server name must be at least 1 character')
      .max(100, 'Server name must be at most 100 characters'),
  ),
});

export const updateServerSchema = z.object({
  name: safeLine(
    z
      .string()
      .min(1, 'Server name must be at least 1 character')
      .max(100, 'Server name must be at most 100 characters'),
  ).optional(),
  iconUrl: z.string().url('Invalid icon URL').max(512).optional(),
  defaultTheme: z.string().max(50).nullable().optional(),
  defaultMode: z.enum(['dark', 'light']).nullable().optional(),
});

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export const memberParamsSchema = z.object({
  serverId: z.string().min(1, 'Server ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type ServerParams = z.infer<typeof serverParamsSchema>;

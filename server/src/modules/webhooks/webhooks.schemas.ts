import { z } from 'zod';
import { snowflakeId, safeLine, safeText } from '../../utils/validation.js';

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export const webhookParamsSchema = z.object({
  serverId: snowflakeId,
  webhookId: snowflakeId,
});

export const executeWebhookParamsSchema = z.object({
  webhookId: snowflakeId,
  token: z.string().min(1, 'Token is required'),
});

export const createWebhookSchema = z.object({
  name: safeLine(z.string().min(1, 'Name is required').max(80, 'Name must be 80 characters or less')),
  channelId: snowflakeId,
  avatarUrl: z.string().url().max(512).optional(),
});

export const updateWebhookSchema = z.object({
  name: safeLine(z.string().min(1, 'Name is required').max(80, 'Name must be 80 characters or less')).optional(),
  channelId: snowflakeId.optional(),
  avatarUrl: z.string().url().max(512).nullable().optional(),
});

export const executeWebhookSchema = z.object({
  content: safeText(z.string().min(1, 'Content is required').max(4000, 'Content must be 4000 characters or less')),
  username: safeLine(z.string().min(1).max(80)).optional(),
  avatarUrl: z.string().url().max(512).optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type ExecuteWebhookInput = z.infer<typeof executeWebhookSchema>;

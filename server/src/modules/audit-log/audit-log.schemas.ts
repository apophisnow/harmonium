import { z } from 'zod';
import { snowflakeId } from '../../utils/validation.js';

export const auditLogParamsSchema = z.object({
  serverId: snowflakeId,
});

export const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  before: snowflakeId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

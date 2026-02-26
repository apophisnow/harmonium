import { z } from 'zod';
import { snowflakeId } from '../../utils/validation.js';

export const channelParamsSchema = z.object({
  channelId: snowflakeId,
});

export const serverParamsSchema = z.object({
  serverId: snowflakeId,
});

export const markReadBodySchema = z.object({
  messageId: snowflakeId,
});

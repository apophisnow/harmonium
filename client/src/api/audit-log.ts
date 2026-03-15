import type { AuditLogEntry } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getAuditLog(
  serverId: string,
  params?: { action?: string; before?: string; limit?: number },
): Promise<AuditLogEntry[]> {
  const response = await apiClient.get<AuditLogEntry[]>(
    `/servers/${serverId}/audit-log`,
    { params },
  );
  return response.data;
}

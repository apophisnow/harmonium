import type { Ban } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function banMember(
  serverId: string,
  userId: string,
  reason?: string,
  purgeMessages?: boolean,
): Promise<void> {
  await apiClient.put(`/servers/${serverId}/bans/${userId}`, {
    reason,
    purgeMessages,
  });
}

export async function unbanMember(serverId: string, userId: string): Promise<void> {
  await apiClient.delete(`/servers/${serverId}/bans/${userId}`);
}

export async function getBans(serverId: string): Promise<Ban[]> {
  const response = await apiClient.get<Ban[]>(`/servers/${serverId}/bans`);
  return response.data;
}

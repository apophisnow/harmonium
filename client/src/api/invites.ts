import type { Invite } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function createInvite(
  serverId: string,
  channelId: string,
  data?: { maxUses?: number; expiresInHours?: number },
): Promise<Invite> {
  const response = await apiClient.post<Invite>(
    `/servers/${serverId}/invites`,
    { channelId, ...data },
  );
  return response.data;
}

export async function acceptInvite(
  code: string,
): Promise<{ serverId: string }> {
  const response = await apiClient.post<{ serverId: string }>(
    `/invites/${code}/accept`,
  );
  return response.data;
}

export async function getInviteInfo(code: string): Promise<Invite> {
  const response = await apiClient.get<Invite>(`/invites/${code}`);
  return response.data;
}

export async function getServerInvites(serverId: string): Promise<Invite[]> {
  const response = await apiClient.get<Invite[]>(
    `/servers/${serverId}/invites`,
  );
  return response.data;
}

export async function deleteInvite(code: string): Promise<void> {
  await apiClient.delete(`/invites/${code}`);
}

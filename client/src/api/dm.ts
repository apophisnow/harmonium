import type { DmChannel } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getDmChannels(): Promise<DmChannel[]> {
  const response = await apiClient.get<DmChannel[]>('/dm/channels');
  return response.data;
}

export async function createDm(recipientId: string): Promise<DmChannel> {
  const response = await apiClient.post<DmChannel>('/dm/channels', { recipientId });
  return response.data;
}

export async function createGroupDm(
  recipientIds: string[],
  name?: string,
): Promise<DmChannel> {
  const response = await apiClient.post<DmChannel>('/dm/channels/group', {
    recipientIds,
    name,
  });
  return response.data;
}

export async function closeDm(channelId: string): Promise<void> {
  await apiClient.delete(`/dm/channels/${channelId}`);
}

export async function updateGroupDm(
  channelId: string,
  data: { name?: string },
): Promise<DmChannel> {
  const response = await apiClient.patch<DmChannel>(`/dm/channels/${channelId}`, data);
  return response.data;
}

export async function addGroupDmMember(
  channelId: string,
  userId: string,
): Promise<DmChannel> {
  const response = await apiClient.put<DmChannel>(
    `/dm/channels/${channelId}/members/${userId}`,
  );
  return response.data;
}

export async function leaveGroupDm(channelId: string): Promise<void> {
  await apiClient.delete(`/dm/channels/${channelId}/members/@me`);
}

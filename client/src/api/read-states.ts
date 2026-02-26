import type { ReadState } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function markChannelRead(
  channelId: string,
  messageId: string,
): Promise<void> {
  await apiClient.post(`/channels/${channelId}/read-state`, { messageId });
}

export async function getServerReadStates(
  serverId: string,
): Promise<ReadState[]> {
  const response = await apiClient.get<ReadState[]>(
    `/servers/${serverId}/read-states`,
  );
  return response.data;
}

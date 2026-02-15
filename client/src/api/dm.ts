import type { DMChannel, DMChannelWithUser, DMMessage } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getDMChannels(): Promise<DMChannelWithUser[]> {
  const response = await apiClient.get<DMChannelWithUser[]>('/dm/channels');
  return response.data;
}

export async function createDMChannel(recipientId: string): Promise<DMChannel> {
  const response = await apiClient.post<DMChannel>('/dm/channels', { recipientId });
  return response.data;
}

export async function getDMMessages(
  dmChannelId: string,
  params?: { before?: string; limit?: number },
): Promise<DMMessage[]> {
  const response = await apiClient.get<DMMessage[]>(
    `/dm/channels/${dmChannelId}/messages`,
    { params },
  );
  return response.data;
}

export async function sendDMMessage(
  dmChannelId: string,
  content: string,
): Promise<DMMessage> {
  const response = await apiClient.post<DMMessage>(
    `/dm/channels/${dmChannelId}/messages`,
    { content },
  );
  return response.data;
}

export async function deleteDMMessage(
  dmChannelId: string,
  messageId: string,
): Promise<void> {
  await apiClient.delete(`/dm/channels/${dmChannelId}/messages/${messageId}`);
}

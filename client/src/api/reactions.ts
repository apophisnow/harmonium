import { apiClient } from './client.js';

export async function addReaction(
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  await apiClient.put(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
  );
}

export async function removeReaction(
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  await apiClient.delete(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
  );
}

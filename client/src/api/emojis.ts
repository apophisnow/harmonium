import type { CustomEmoji } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getServerEmojis(serverId: string): Promise<CustomEmoji[]> {
  const response = await apiClient.get<CustomEmoji[]>(
    `/servers/${serverId}/emojis`,
  );
  return response.data;
}

export async function getEmoji(serverId: string, emojiId: string): Promise<CustomEmoji> {
  const response = await apiClient.get<CustomEmoji>(
    `/servers/${serverId}/emojis/${emojiId}`,
  );
  return response.data;
}

export async function uploadEmoji(
  serverId: string,
  name: string,
  file: File,
): Promise<CustomEmoji> {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);

  const response = await apiClient.post<CustomEmoji>(
    `/servers/${serverId}/emojis`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data;
}

export async function renameEmoji(
  serverId: string,
  emojiId: string,
  name: string,
): Promise<CustomEmoji> {
  const response = await apiClient.patch<CustomEmoji>(
    `/servers/${serverId}/emojis/${emojiId}`,
    { name },
  );
  return response.data;
}

export async function deleteEmoji(
  serverId: string,
  emojiId: string,
): Promise<void> {
  await apiClient.delete(`/servers/${serverId}/emojis/${emojiId}`);
}

import type { Message } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getMessages(
  channelId: string,
  params?: { before?: string; limit?: number },
): Promise<Message[]> {
  const response = await apiClient.get<Message[]>(
    `/channels/${channelId}/messages`,
    { params },
  );
  return response.data;
}

export async function sendMessage(
  channelId: string,
  content: string,
  files?: File[],
  replyToId?: string,
): Promise<Message> {
  if (files && files.length > 0) {
    const formData = new FormData();
    if (content) {
      formData.append('content', content);
    }
    if (replyToId) {
      formData.append('replyToId', replyToId);
    }
    for (const file of files) {
      formData.append('files', file, file.name);
    }
    const response = await apiClient.post<Message>(
      `/channels/${channelId}/messages`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  }

  const response = await apiClient.post<Message>(
    `/channels/${channelId}/messages`,
    { content, replyToId },
  );
  return response.data;
}

export async function editMessage(
  channelId: string,
  messageId: string,
  content: string,
): Promise<Message> {
  const response = await apiClient.patch<Message>(
    `/channels/${channelId}/messages/${messageId}`,
    { content },
  );
  return response.data;
}

export async function deleteMessage(
  channelId: string,
  messageId: string,
): Promise<void> {
  await apiClient.delete(`/channels/${channelId}/messages/${messageId}`);
}

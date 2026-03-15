import type { Channel, ThreadListItem } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function createThread(
  channelId: string,
  data: { name: string; messageId: string },
): Promise<Channel> {
  const response = await apiClient.post<Channel>(
    `/channels/${channelId}/threads`,
    data,
  );
  return response.data;
}

export async function getThreads(channelId: string): Promise<ThreadListItem[]> {
  const response = await apiClient.get<ThreadListItem[]>(
    `/channels/${channelId}/threads`,
  );
  return response.data;
}

export async function getThread(threadId: string): Promise<Channel> {
  const response = await apiClient.get<Channel>(`/threads/${threadId}`);
  return response.data;
}

export async function archiveThread(threadId: string): Promise<Channel> {
  const response = await apiClient.post<Channel>(
    `/threads/${threadId}/archive`,
  );
  return response.data;
}

export async function unarchiveThread(threadId: string): Promise<Channel> {
  const response = await apiClient.post<Channel>(
    `/threads/${threadId}/unarchive`,
  );
  return response.data;
}

export async function joinThread(threadId: string): Promise<void> {
  await apiClient.post(`/threads/${threadId}/join`);
}

export async function leaveThread(threadId: string): Promise<void> {
  await apiClient.post(`/threads/${threadId}/leave`);
}

export async function deleteThread(threadId: string): Promise<void> {
  await apiClient.delete(`/threads/${threadId}`);
}

import type { Relationship } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getRelationships(): Promise<Relationship[]> {
  const response = await apiClient.get<Relationship[]>('/relationships');
  return response.data;
}

export async function sendFriendRequest(username: string, discriminator: string): Promise<void> {
  await apiClient.post('/relationships/friends', { username, discriminator });
}

export async function acceptFriendRequest(userId: string): Promise<void> {
  await apiClient.put(`/relationships/friends/${userId}`);
}

export async function declineFriendRequest(userId: string): Promise<void> {
  await apiClient.delete(`/relationships/friends/${userId}`);
}

export async function removeFriend(userId: string): Promise<void> {
  await apiClient.delete(`/relationships/friends/${userId}`);
}

export async function blockUser(userId: string): Promise<void> {
  await apiClient.put(`/relationships/blocks/${userId}`);
}

export async function unblockUser(userId: string): Promise<void> {
  await apiClient.delete(`/relationships/blocks/${userId}`);
}

export async function ignoreUser(userId: string): Promise<void> {
  await apiClient.put(`/relationships/ignores/${userId}`);
}

export async function unignoreUser(userId: string): Promise<void> {
  await apiClient.delete(`/relationships/ignores/${userId}`);
}

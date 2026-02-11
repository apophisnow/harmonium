import type { Server, ServerMember } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getServers(): Promise<Server[]> {
  const response = await apiClient.get<Server[]>('/servers');
  return response.data;
}

export async function createServer(
  name: string,
  icon?: File,
): Promise<Server> {
  if (icon) {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('icon', icon);
    const response = await apiClient.post<Server>('/servers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
  const response = await apiClient.post<Server>('/servers', { name });
  return response.data;
}

export async function updateServer(
  id: string,
  data: Partial<Pick<Server, 'name' | 'iconUrl'>>,
): Promise<Server> {
  const response = await apiClient.patch<Server>(`/servers/${id}`, data);
  return response.data;
}

export async function deleteServer(id: string): Promise<void> {
  await apiClient.delete(`/servers/${id}`);
}

export async function getMembers(serverId: string): Promise<ServerMember[]> {
  const response = await apiClient.get<ServerMember[]>(
    `/servers/${serverId}/members`,
  );
  return response.data;
}

export async function kickMember(serverId: string, userId: string): Promise<void> {
  await apiClient.delete(`/servers/${serverId}/members/${userId}`);
}

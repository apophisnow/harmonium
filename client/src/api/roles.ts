import type { Role } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getRoles(serverId: string): Promise<Role[]> {
  const response = await apiClient.get<Role[]>(
    `/servers/${serverId}/roles`,
  );
  return response.data;
}

export async function createRole(serverId: string, data: { name: string; color?: number; permissions?: string }): Promise<Role> {
  const response = await apiClient.post<Role>(`/servers/${serverId}/roles`, data);
  return response.data;
}

export async function updateRole(serverId: string, roleId: string, data: { name?: string; color?: number | null; permissions?: string; position?: number }): Promise<Role> {
  const response = await apiClient.patch<Role>(`/servers/${serverId}/roles/${roleId}`, data);
  return response.data;
}

export async function deleteRole(serverId: string, roleId: string): Promise<void> {
  await apiClient.delete(`/servers/${serverId}/roles/${roleId}`);
}

export async function reorderRoles(serverId: string, roles: Array<{ id: string; position: number }>): Promise<Role[]> {
  const response = await apiClient.patch<Role[]>(`/servers/${serverId}/roles/reorder`, { roles });
  return response.data;
}

export async function assignRole(serverId: string, roleId: string, userId: string): Promise<Role> {
  const response = await apiClient.put<Role>(`/servers/${serverId}/roles/${roleId}/members/${userId}`);
  return response.data;
}

export async function removeRole(serverId: string, roleId: string, userId: string): Promise<void> {
  await apiClient.delete(`/servers/${serverId}/roles/${roleId}/members/${userId}`);
}

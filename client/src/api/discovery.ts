import type { DiscoveryResponse, DiscoveryServer, DiscoverySettings } from '@harmonium/shared';
import { apiClient } from './client.js';

export interface DiscoveryQueryParams {
  search?: string;
  category?: string;
  sort?: 'member_count' | 'newest';
  page?: number;
  limit?: number;
}

export async function getDiscoverableServers(params: DiscoveryQueryParams = {}): Promise<DiscoveryResponse> {
  const response = await apiClient.get<DiscoveryResponse>('/discovery/servers', { params });
  return response.data;
}

export async function getDiscoveryServer(serverId: string): Promise<DiscoveryServer> {
  const response = await apiClient.get<DiscoveryServer>(`/discovery/servers/${serverId}`);
  return response.data;
}

export async function getDiscoverySettings(serverId: string): Promise<DiscoverySettings> {
  const response = await apiClient.get<DiscoverySettings>(`/servers/${serverId}/discovery`);
  return response.data;
}

export async function updateDiscoverySettings(
  serverId: string,
  data: Partial<DiscoverySettings>,
): Promise<DiscoverySettings> {
  const response = await apiClient.patch<DiscoverySettings>(`/servers/${serverId}/discovery`, data);
  return response.data;
}

export async function joinDiscoveryServer(serverId: string): Promise<void> {
  // Use the invite-less join — reuse the existing servers API
  await apiClient.post(`/servers/${serverId}/join`);
}

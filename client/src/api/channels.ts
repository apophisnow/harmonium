import type { Channel, ChannelType } from '@harmonium/shared';
import { apiClient } from './client.js';

interface ChannelsResponse {
  uncategorized: Channel[];
  categories: { category: { id: string; name: string }; channels: Channel[] }[];
}

export async function getChannels(serverId: string): Promise<Channel[]> {
  const response = await apiClient.get<ChannelsResponse>(
    `/servers/${serverId}/channels`,
  );
  const { uncategorized, categories } = response.data;
  return [
    ...uncategorized,
    ...categories.flatMap((g) => g.channels),
  ];
}

export async function createChannel(
  serverId: string,
  data: { name: string; type: ChannelType; categoryId?: string },
): Promise<Channel> {
  const response = await apiClient.post<Channel>(
    `/servers/${serverId}/channels`,
    data,
  );
  return response.data;
}

export async function updateChannel(
  channelId: string,
  data: Partial<Pick<Channel, 'name' | 'topic' | 'position'>>,
): Promise<Channel> {
  const response = await apiClient.patch<Channel>(
    `/channels/${channelId}`,
    data,
  );
  return response.data;
}

export async function deleteChannel(channelId: string): Promise<void> {
  await apiClient.delete(`/channels/${channelId}`);
}

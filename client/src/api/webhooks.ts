import type { Webhook, WebhookInfo } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function createWebhook(
  serverId: string,
  data: { name: string; channelId: string; avatarUrl?: string },
): Promise<Webhook> {
  const response = await apiClient.post<Webhook>(
    `/servers/${serverId}/webhooks`,
    data,
  );
  return response.data;
}

export async function getWebhooks(serverId: string): Promise<WebhookInfo[]> {
  const response = await apiClient.get<WebhookInfo[]>(
    `/servers/${serverId}/webhooks`,
  );
  return response.data;
}

export async function updateWebhook(
  serverId: string,
  webhookId: string,
  data: { name?: string; channelId?: string; avatarUrl?: string | null },
): Promise<WebhookInfo> {
  const response = await apiClient.patch<WebhookInfo>(
    `/servers/${serverId}/webhooks/${webhookId}`,
    data,
  );
  return response.data;
}

export async function deleteWebhook(
  serverId: string,
  webhookId: string,
): Promise<void> {
  await apiClient.delete(`/servers/${serverId}/webhooks/${webhookId}`);
}

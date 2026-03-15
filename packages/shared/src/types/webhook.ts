export interface Webhook {
  id: string;
  serverId: string;
  channelId: string;
  name: string;
  avatarUrl: string | null;
  token: string;
  createdBy: string;
  createdAt: string;
}

/** Webhook info without the token, safe to expose in lists */
export interface WebhookInfo {
  id: string;
  serverId: string;
  channelId: string;
  name: string;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: string;
}

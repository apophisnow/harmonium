export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: number | null;
  position: number;
  permissions: string;     // bigint as string
  isDefault: boolean;
  createdAt: string;
}

export interface ChannelPermissionOverride {
  channelId: string;
  targetType: 'role' | 'member';
  targetId: string;
  allow: string;           // bigint as string
  deny: string;            // bigint as string
}

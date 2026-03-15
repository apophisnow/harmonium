export type ChannelType = 'text' | 'voice';

export interface Channel {
  id: string;
  serverId: string;
  categoryId: string | null;
  name: string;
  type: ChannelType;
  topic: string | null;
  position: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  // Thread fields (only present when isThread is true)
  isThread?: boolean;
  parentChannelId?: string | null;
  originMessageId?: string | null;
  threadArchived?: boolean;
  threadArchivedAt?: string | null;
  lastMessageAt?: string | null;
  messageCount?: number;
}

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: string;
}

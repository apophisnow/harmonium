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
}

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: string;
}

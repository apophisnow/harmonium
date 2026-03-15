import type { Channel } from './channel.js';

export interface Thread extends Channel {
  isThread: true;
  parentChannelId: string;
  originMessageId: string;
  threadArchived: boolean;
  threadArchivedAt: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}

export interface ThreadListItem {
  id: string;
  name: string;
  parentChannelId: string;
  originMessageId: string;
  threadArchived: boolean;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
}

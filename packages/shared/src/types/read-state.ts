export interface ReadState {
  channelId: string;
  lastReadMessageId: string | null;
  mentionCount: number;
}

export interface UnreadInfo {
  channelId: string;
  hasUnread: boolean;
  mentionCount: number;
}

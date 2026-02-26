import { create } from 'zustand';
import type { ReadState, UnreadInfo } from '@harmonium/shared';

interface UnreadState {
  readStates: Map<string, ReadState>;

  setReadStates: (states: ReadState[]) => void;
  markRead: (channelId: string, messageId: string) => void;
  handleNewMessage: (
    channelId: string,
    messageId: string,
    mentions: string[],
    currentUserId: string,
  ) => void;
  getUnreadInfo: (channelId: string, latestMessageId?: string) => UnreadInfo;
  getServerUnreadInfo: (
    serverId: string,
    channelIds: string[],
  ) => { hasUnread: boolean; mentionCount: number };
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  readStates: new Map(),

  setReadStates: (states) => {
    const readStates = new Map<string, ReadState>();
    for (const state of states) {
      readStates.set(state.channelId, state);
    }
    set({ readStates });
  },

  markRead: (channelId, messageId) => {
    const readStates = new Map(get().readStates);
    readStates.set(channelId, {
      channelId,
      lastReadMessageId: messageId,
      mentionCount: 0,
    });
    set({ readStates });
  },

  handleNewMessage: (channelId, messageId, mentions, currentUserId) => {
    const readStates = new Map(get().readStates);
    const existing = readStates.get(channelId);

    // If there's no read state for this channel, it means the user hasn't
    // read anything yet — every message is unread
    const isMentioned = mentions.includes(currentUserId);
    const currentMentionCount = existing?.mentionCount ?? 0;

    readStates.set(channelId, {
      channelId,
      lastReadMessageId: existing?.lastReadMessageId ?? null,
      mentionCount: currentMentionCount + (isMentioned ? 1 : 0),
    });
    set({ readStates });
  },

  getUnreadInfo: (channelId, latestMessageId) => {
    const state = get().readStates.get(channelId);
    if (!state) {
      return { channelId, hasUnread: false, mentionCount: 0 };
    }

    // If no lastReadMessageId, user hasn't read the channel — but only mark
    // unread if there's a latest message to compare against
    if (!state.lastReadMessageId) {
      return {
        channelId,
        hasUnread: !!latestMessageId,
        mentionCount: state.mentionCount,
      };
    }

    // Snowflake IDs are time-ordered, so we can compare as strings
    // (they're numeric strings, so lexicographic comparison works for same-length IDs)
    const hasUnread = latestMessageId
      ? BigInt(latestMessageId) > BigInt(state.lastReadMessageId)
      : false;

    return {
      channelId,
      hasUnread,
      mentionCount: state.mentionCount,
    };
  },

  getServerUnreadInfo: (_serverId, channelIds) => {
    let hasUnread = false;
    let mentionCount = 0;

    for (const channelId of channelIds) {
      const state = get().readStates.get(channelId);
      if (state) {
        if (state.mentionCount > 0) {
          mentionCount += state.mentionCount;
          hasUnread = true;
        }
        // For hasUnread without latestMessageId, we check if there's a read state
        // with no lastReadMessageId (meaning unread messages exist)
        if (!state.lastReadMessageId && state.mentionCount >= 0) {
          // Can't determine without latestMessageId — the component will pass it
        }
      }
    }

    return { hasUnread, mentionCount };
  },
}));

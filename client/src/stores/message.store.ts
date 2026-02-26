import { create } from 'zustand';
import type { Message } from '@harmonium/shared';
import { getMessages } from '../api/messages.js';

const DEFAULT_LIMIT = 50;

interface MessageState {
  messages: Map<string, Message[]>;
  hasMore: Map<string, boolean>;
  replyingTo: Message | null;

  fetchMessages: (channelId: string, before?: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Partial<Message> & { id: string; channelId: string }) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  setReplyingTo: (message: Message | null) => void;
  addReaction: (channelId: string, messageId: string, userId: string, emoji: string) => void;
  removeReaction: (channelId: string, messageId: string, userId: string, emoji: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: new Map(),
  hasMore: new Map(),
  replyingTo: null,

  fetchMessages: async (channelId, before) => {
    const fetched = await getMessages(channelId, {
      before,
      limit: DEFAULT_LIMIT,
    });
    const messages = new Map(get().messages);
    const hasMore = new Map(get().hasMore);

    const existing = before ? (messages.get(channelId) ?? []) : [];
    // Messages come newest-first from API; prepend older ones
    messages.set(channelId, [...fetched, ...existing]);
    hasMore.set(channelId, fetched.length === DEFAULT_LIMIT);

    set({ messages, hasMore });
  },

  addMessage: (message) => {
    const messages = new Map(get().messages);
    const list = messages.get(message.channelId) ?? [];
    messages.set(message.channelId, [...list, message]);
    set({ messages });
  },

  updateMessage: (partial) => {
    const messages = new Map(get().messages);
    const list = messages.get(partial.channelId) ?? [];
    messages.set(
      partial.channelId,
      list.map((m) => (m.id === partial.id ? { ...m, ...partial } : m)),
    );
    set({ messages });
  },

  deleteMessage: (channelId, messageId) => {
    const messages = new Map(get().messages);
    const list = messages.get(channelId) ?? [];
    messages.set(
      channelId,
      list.filter((m) => m.id !== messageId),
    );
    set({ messages });
  },

  setReplyingTo: (message) => {
    set({ replyingTo: message });
  },

  addReaction: (channelId, messageId, userId, emoji) => {
    const messages = new Map(get().messages);
    const list = messages.get(channelId) ?? [];
    messages.set(
      channelId,
      list.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions ?? [])];
        const existing = reactions.find((r) => r.emoji === emoji);
        if (existing) {
          if (!existing.userIds.includes(userId)) {
            existing.userIds = [...existing.userIds, userId];
            existing.count = existing.userIds.length;
          }
        } else {
          reactions.push({ emoji, count: 1, userIds: [userId] });
        }
        return { ...m, reactions };
      }),
    );
    set({ messages });
  },

  removeReaction: (channelId, messageId, userId, emoji) => {
    const messages = new Map(get().messages);
    const list = messages.get(channelId) ?? [];
    messages.set(
      channelId,
      list.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = (m.reactions ?? [])
          .map((r) => {
            if (r.emoji !== emoji) return r;
            const userIds = r.userIds.filter((id) => id !== userId);
            return { ...r, userIds, count: userIds.length };
          })
          .filter((r) => r.count > 0);
        return { ...m, reactions };
      }),
    );
    set({ messages });
  },
}));

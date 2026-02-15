import { create } from 'zustand';
import type { DMChannelWithUser, DMMessage } from '@harmonium/shared';
import * as dmApi from '../api/dm.js';

const DEFAULT_LIMIT = 50;

interface DMState {
  channels: DMChannelWithUser[];
  messages: Map<string, DMMessage[]>;
  hasMore: Map<string, boolean>;
  currentDMChannelId: string | null;

  fetchChannels: () => Promise<void>;
  setCurrentDMChannel: (id: string | null) => void;
  openChannel: (recipientId: string) => Promise<string>;

  fetchMessages: (dmChannelId: string, before?: string) => Promise<void>;
  addMessage: (dmChannelId: string, message: DMMessage) => void;
  deleteMessage: (dmChannelId: string, messageId: string) => void;

  addChannel: (channel: DMChannelWithUser) => void;
  updateChannelLastMessage: (dmChannelId: string, message: DMMessage) => void;
}

export const useDMStore = create<DMState>((set, get) => ({
  channels: [],
  messages: new Map(),
  hasMore: new Map(),
  currentDMChannelId: null,

  fetchChannels: async () => {
    const channels = await dmApi.getDMChannels();
    set({ channels });
  },

  setCurrentDMChannel: (id) => {
    set({ currentDMChannelId: id });
  },

  openChannel: async (recipientId) => {
    const channel = await dmApi.createDMChannel(recipientId);
    // Refresh channels list to get the full DMChannelWithUser
    await get().fetchChannels();
    return channel.id;
  },

  fetchMessages: async (dmChannelId, before) => {
    const fetched = await dmApi.getDMMessages(dmChannelId, {
      before,
      limit: DEFAULT_LIMIT,
    });
    const messages = new Map(get().messages);
    const hasMore = new Map(get().hasMore);

    const existing = before ? (messages.get(dmChannelId) ?? []) : [];
    messages.set(dmChannelId, [...fetched, ...existing]);
    hasMore.set(dmChannelId, fetched.length === DEFAULT_LIMIT);

    set({ messages, hasMore });
  },

  addMessage: (dmChannelId, message) => {
    const messages = new Map(get().messages);
    const list = messages.get(dmChannelId) ?? [];
    messages.set(dmChannelId, [...list, message]);
    set({ messages });

    // Also update the channel's last message and move it to top
    get().updateChannelLastMessage(dmChannelId, message);
  },

  deleteMessage: (dmChannelId, messageId) => {
    const messages = new Map(get().messages);
    const list = messages.get(dmChannelId) ?? [];
    messages.set(
      dmChannelId,
      list.filter((m) => m.id !== messageId),
    );
    set({ messages });
  },

  addChannel: (channel) => {
    const channels = [...get().channels];
    const existing = channels.findIndex((c) => c.id === channel.id);
    if (existing >= 0) {
      channels[existing] = channel;
    } else {
      channels.unshift(channel);
    }
    set({ channels });
  },

  updateChannelLastMessage: (dmChannelId, message) => {
    const channels = [...get().channels];
    const idx = channels.findIndex((c) => c.id === dmChannelId);
    if (idx >= 0) {
      channels[idx] = {
        ...channels[idx],
        lastMessage: {
          id: message.id,
          channelId: dmChannelId,
          authorId: message.authorId,
          content: message.content,
          editedAt: null,
          isDeleted: false,
          createdAt: message.createdAt,
        },
      };
      // Move to top
      const [updated] = channels.splice(idx, 1);
      channels.unshift(updated);
      set({ channels });
    }
  },
}));

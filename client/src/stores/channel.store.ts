import { create } from 'zustand';
import type { Channel } from '@harmonium/shared';
import { getChannels } from '../api/channels.js';

interface ChannelState {
  channels: Map<string, Channel[]>;
  currentChannelId: string | null;

  fetchChannels: (serverId: string) => Promise<void>;
  setCurrentChannel: (id: string | null) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string, serverId: string) => void;
  updateChannel: (channel: Channel) => void;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: new Map(),
  currentChannelId: null,

  fetchChannels: async (serverId) => {
    const channelList = await getChannels(serverId);
    const channels = new Map(get().channels);
    channels.set(serverId, channelList);
    set({ channels });
  },

  setCurrentChannel: (id) => {
    set({ currentChannelId: id });
  },

  addChannel: (channel) => {
    const channels = new Map(get().channels);
    const list = channels.get(channel.serverId) ?? [];
    if (list.some((c) => c.id === channel.id)) return;
    channels.set(channel.serverId, [...list, channel]);
    set({ channels });
  },

  removeChannel: (channelId, serverId) => {
    const channels = new Map(get().channels);
    const list = channels.get(serverId) ?? [];
    channels.set(
      serverId,
      list.filter((c) => c.id !== channelId),
    );
    const currentChannelId =
      get().currentChannelId === channelId ? null : get().currentChannelId;
    set({ channels, currentChannelId });
  },

  updateChannel: (channel) => {
    const channels = new Map(get().channels);
    const list = channels.get(channel.serverId) ?? [];
    channels.set(
      channel.serverId,
      list.map((c) => (c.id === channel.id ? channel : c)),
    );
    set({ channels });
  },
}));

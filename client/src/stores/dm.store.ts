import { create } from 'zustand';
import type { DmChannel } from '@harmonium/shared';
import { getDmChannels, createDm, closeDm as apiCloseDm } from '../api/dm.js';

interface DmState {
  dmChannels: DmChannel[];
  currentDmChannelId: string | null;

  fetchDmChannels: () => Promise<void>;
  setDmChannels: (channels: DmChannel[]) => void;
  openDm: (recipientId: string) => Promise<DmChannel>;
  closeDm: (channelId: string) => Promise<void>;
  addDmChannel: (channel: DmChannel) => void;
  updateDmChannel: (channel: DmChannel) => void;
  setCurrentDmChannel: (channelId: string | null) => void;
}

export const useDmStore = create<DmState>((set, get) => ({
  dmChannels: [],
  currentDmChannelId: null,

  fetchDmChannels: async () => {
    const channels = await getDmChannels();
    set({ dmChannels: channels });
  },

  setDmChannels: (channels) => {
    set({ dmChannels: channels });
  },

  openDm: async (recipientId) => {
    const channel = await createDm(recipientId);
    const existing = get().dmChannels.find((c) => c.id === channel.id);
    if (!existing) {
      set({ dmChannels: [channel, ...get().dmChannels] });
    } else {
      // Update existing channel (may have been reopened)
      set({
        dmChannels: get().dmChannels.map((c) =>
          c.id === channel.id ? channel : c,
        ),
      });
    }
    return channel;
  },

  closeDm: async (channelId) => {
    await apiCloseDm(channelId);
    set({
      dmChannels: get().dmChannels.filter((c) => c.id !== channelId),
      currentDmChannelId:
        get().currentDmChannelId === channelId ? null : get().currentDmChannelId,
    });
  },

  addDmChannel: (channel) => {
    const existing = get().dmChannels.find((c) => c.id === channel.id);
    if (existing) {
      // Update existing
      set({
        dmChannels: get().dmChannels.map((c) =>
          c.id === channel.id ? channel : c,
        ),
      });
    } else {
      set({ dmChannels: [channel, ...get().dmChannels] });
    }
  },

  updateDmChannel: (channel) => {
    set({
      dmChannels: get().dmChannels.map((c) =>
        c.id === channel.id ? channel : c,
      ),
    });
  },

  setCurrentDmChannel: (channelId) => {
    set({ currentDmChannelId: channelId });
  },
}));

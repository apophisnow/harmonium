import { create } from 'zustand';
import type { ProducerType } from '@harmonium/shared';

export interface VoiceParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  hasWebcam: boolean;
}

/** Lightweight voice state for sidebar display (all channels in a server) */
export interface ChannelVoiceUser {
  userId: string;
  username: string;
  avatarUrl: string | null;
  selfMute: boolean;
  selfDeaf: boolean;
  isScreenSharing: boolean;
  hasWebcam: boolean;
}

interface VoiceState {
  currentChannelId: string | null;
  currentServerId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  screenShareUserId: string | null;
  participants: Map<string, VoiceParticipant>;
  webcamStreams: Map<string, MediaStream>;
  isWebcamOn: boolean;

  /** Server-wide voice states: channelId -> userId -> ChannelVoiceUser */
  channelVoiceStates: Map<string, Map<string, ChannelVoiceUser>>;

  joinChannel: (channelId: string, serverId: string) => void;
  leaveChannel: () => void;
  setConnecting: (connecting: boolean) => void;
  setConnected: (connected: boolean) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setScreenSharing: (sharing: boolean) => void;
  setScreenShareUser: (userId: string | null) => void;
  addParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (
    userId: string,
    updates: Partial<VoiceParticipant>,
  ) => void;
  setParticipants: (participants: VoiceParticipant[]) => void;
  setWebcamStream: (userId: string, stream: MediaStream) => void;
  removeWebcamStream: (userId: string) => void;
  setWebcamOn: (on: boolean) => void;

  /** Populate channel voice states from API response */
  setChannelVoiceStates: (states: Array<{ userId: string; channelId: string; username: string; selfMute: boolean; selfDeaf: boolean }>) => void;
  /** Add/update a user in a channel's voice state */
  addChannelVoiceUser: (channelId: string, user: ChannelVoiceUser) => void;
  /** Remove a user from all channel voice states */
  removeChannelVoiceUser: (userId: string) => void;
  /** Update a user's producer state (screen share, webcam) in channel voice states */
  updateChannelVoiceUser: (channelId: string, userId: string, updates: Partial<ChannelVoiceUser>) => void;
  /** Clear all channel voice states (e.g. when switching server) */
  clearChannelVoiceStates: () => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  currentChannelId: null,
  currentServerId: null,
  isConnected: false,
  isConnecting: false,
  isMuted: false,
  isDeafened: false,
  isScreenSharing: false,
  screenShareUserId: null,
  participants: new Map(),
  webcamStreams: new Map(),
  isWebcamOn: false,
  channelVoiceStates: new Map(),

  joinChannel: (channelId, serverId) => {
    set({
      currentChannelId: channelId,
      currentServerId: serverId,
      isConnecting: true,
      participants: new Map(),
      webcamStreams: new Map(),
      isWebcamOn: false,
    });
  },

  leaveChannel: () => {
    set({
      currentChannelId: null,
      currentServerId: null,
      isConnected: false,
      isConnecting: false,
      isMuted: false,
      isDeafened: false,
      isScreenSharing: false,
      screenShareUserId: null,
      participants: new Map(),
      webcamStreams: new Map(),
      isWebcamOn: false,
    });
  },

  setConnecting: (connecting) => {
    set({ isConnecting: connecting });
  },

  setConnected: (connected) => {
    set({ isConnected: connected, isConnecting: !connected && get().isConnecting });
  },

  toggleMute: () => {
    set({ isMuted: !get().isMuted });
  },

  toggleDeafen: () => {
    const wasDeafened = get().isDeafened;
    set({
      isDeafened: !wasDeafened,
      // When undeafening, also unmute; when deafening, also mute
      isMuted: !wasDeafened ? true : get().isMuted,
    });
  },

  setScreenSharing: (sharing) => {
    set({ isScreenSharing: sharing });
  },

  setScreenShareUser: (userId) => {
    set({ screenShareUserId: userId });
  },

  addParticipant: (participant) => {
    const participants = new Map(get().participants);
    participants.set(participant.userId, {
      ...participant,
      isScreenSharing: participant.isScreenSharing ?? false,
      hasWebcam: participant.hasWebcam ?? false,
    });
    set({ participants });
  },

  removeParticipant: (userId) => {
    const participants = new Map(get().participants);
    participants.delete(userId);
    set({ participants });
  },

  updateParticipant: (userId, updates) => {
    const participants = new Map(get().participants);
    const existing = participants.get(userId);
    if (existing) {
      participants.set(userId, { ...existing, ...updates });
      set({ participants });
    }
  },

  setParticipants: (participantList) => {
    const participants = new Map<string, VoiceParticipant>();
    for (const p of participantList) {
      participants.set(p.userId, p);
    }
    set({ participants });
  },

  setWebcamStream: (userId, stream) => {
    const webcamStreams = new Map(get().webcamStreams);
    webcamStreams.set(userId, stream);
    set({ webcamStreams });
  },

  removeWebcamStream: (userId) => {
    const webcamStreams = new Map(get().webcamStreams);
    webcamStreams.delete(userId);
    const participants = new Map(get().participants);
    const existing = participants.get(userId);
    if (existing) {
      participants.set(userId, { ...existing, hasWebcam: false });
    }
    set({ webcamStreams, participants });
  },

  setWebcamOn: (on) => {
    set({ isWebcamOn: on });
  },

  // --- Channel voice states (server-wide, for sidebar display) ---

  setChannelVoiceStates: (states) => {
    const channelVoiceStates = new Map<string, Map<string, ChannelVoiceUser>>();
    for (const s of states) {
      if (!channelVoiceStates.has(s.channelId)) {
        channelVoiceStates.set(s.channelId, new Map());
      }
      channelVoiceStates.get(s.channelId)!.set(s.userId, {
        userId: s.userId,
        username: s.username,
        avatarUrl: null,
        selfMute: s.selfMute,
        selfDeaf: s.selfDeaf,
        isScreenSharing: false,
        hasWebcam: false,
      });
    }
    set({ channelVoiceStates });
  },

  addChannelVoiceUser: (channelId, user) => {
    const channelVoiceStates = new Map(get().channelVoiceStates);
    // Remove user from any other channel first
    for (const [chId, users] of channelVoiceStates) {
      if (users.has(user.userId)) {
        const newUsers = new Map(users);
        newUsers.delete(user.userId);
        if (newUsers.size === 0) {
          channelVoiceStates.delete(chId);
        } else {
          channelVoiceStates.set(chId, newUsers);
        }
      }
    }
    // Add to new channel
    if (!channelVoiceStates.has(channelId)) {
      channelVoiceStates.set(channelId, new Map());
    }
    const channelUsers = new Map(channelVoiceStates.get(channelId)!);
    channelUsers.set(user.userId, user);
    channelVoiceStates.set(channelId, channelUsers);
    set({ channelVoiceStates });
  },

  removeChannelVoiceUser: (userId) => {
    const channelVoiceStates = new Map(get().channelVoiceStates);
    for (const [chId, users] of channelVoiceStates) {
      if (users.has(userId)) {
        const newUsers = new Map(users);
        newUsers.delete(userId);
        if (newUsers.size === 0) {
          channelVoiceStates.delete(chId);
        } else {
          channelVoiceStates.set(chId, newUsers);
        }
        break;
      }
    }
    set({ channelVoiceStates });
  },

  updateChannelVoiceUser: (channelId, userId, updates) => {
    const channelVoiceStates = new Map(get().channelVoiceStates);
    const channelUsers = channelVoiceStates.get(channelId);
    if (channelUsers) {
      const existing = channelUsers.get(userId);
      if (existing) {
        const newUsers = new Map(channelUsers);
        newUsers.set(userId, { ...existing, ...updates });
        channelVoiceStates.set(channelId, newUsers);
        set({ channelVoiceStates });
      }
    }
  },

  clearChannelVoiceStates: () => {
    set({ channelVoiceStates: new Map() });
  },
}));

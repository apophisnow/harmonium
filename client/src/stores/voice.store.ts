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
}));

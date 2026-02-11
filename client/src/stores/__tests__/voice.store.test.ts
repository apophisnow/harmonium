import { describe, it, expect, beforeEach } from 'vitest';
import { useVoiceStore } from '../voice.store.js';
import type { VoiceParticipant } from '../voice.store.js';

const makeParticipant = (userId: string, username: string): VoiceParticipant => ({
  userId,
  username,
  avatarUrl: null,
  isMuted: false,
  isDeafened: false,
  isSpeaking: false,
  isScreenSharing: false,
  hasWebcam: false,
});

describe('useVoiceStore', () => {
  beforeEach(() => {
    useVoiceStore.setState({
      currentChannelId: null,
      currentServerId: null,
      isConnected: false,
      isConnecting: false,
      isMuted: false,
      isDeafened: false,
      participants: new Map(),
    });
  });

  it('joinChannel sets channelId, serverId, and isConnecting', () => {
    useVoiceStore.getState().joinChannel('ch-1', 'srv-1');

    const state = useVoiceStore.getState();
    expect(state.currentChannelId).toBe('ch-1');
    expect(state.currentServerId).toBe('srv-1');
    expect(state.isConnecting).toBe(true);
    expect(state.participants.size).toBe(0);
  });

  it('leaveChannel resets all voice state', () => {
    useVoiceStore.setState({
      currentChannelId: 'ch-1',
      currentServerId: 'srv-1',
      isConnected: true,
      isConnecting: false,
      isMuted: true,
      isDeafened: true,
      participants: new Map([['u1', makeParticipant('u1', 'User1')]]),
    });

    useVoiceStore.getState().leaveChannel();

    const state = useVoiceStore.getState();
    expect(state.currentChannelId).toBeNull();
    expect(state.currentServerId).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.isMuted).toBe(false);
    expect(state.isDeafened).toBe(false);
    expect(state.participants.size).toBe(0);
  });

  it('toggleMute toggles the isMuted flag', () => {
    expect(useVoiceStore.getState().isMuted).toBe(false);
    useVoiceStore.getState().toggleMute();
    expect(useVoiceStore.getState().isMuted).toBe(true);
    useVoiceStore.getState().toggleMute();
    expect(useVoiceStore.getState().isMuted).toBe(false);
  });

  it('toggleDeafen enables deafen and auto-mutes, undeafen preserves mute state', () => {
    // Deafening should also mute
    useVoiceStore.getState().toggleDeafen();
    expect(useVoiceStore.getState().isDeafened).toBe(true);
    expect(useVoiceStore.getState().isMuted).toBe(true);

    // Undeafening should preserve the mute state (which was set to true by deafen)
    useVoiceStore.getState().toggleDeafen();
    expect(useVoiceStore.getState().isDeafened).toBe(false);
    // When undeafening, isMuted stays as get().isMuted (which is true from the deafen)
    expect(useVoiceStore.getState().isMuted).toBe(true);
  });

  it('addParticipant and removeParticipant manage participants map', () => {
    const p1 = makeParticipant('u1', 'User1');
    const p2 = makeParticipant('u2', 'User2');

    useVoiceStore.getState().addParticipant(p1);
    useVoiceStore.getState().addParticipant(p2);

    expect(useVoiceStore.getState().participants.size).toBe(2);
    expect(useVoiceStore.getState().participants.get('u1')).toEqual(p1);

    useVoiceStore.getState().removeParticipant('u1');

    expect(useVoiceStore.getState().participants.size).toBe(1);
    expect(useVoiceStore.getState().participants.has('u1')).toBe(false);
    expect(useVoiceStore.getState().participants.has('u2')).toBe(true);
  });

  it('updateParticipant merges updates into existing participant', () => {
    const p1 = makeParticipant('u1', 'User1');
    useVoiceStore.setState({
      participants: new Map([['u1', p1]]),
    });

    useVoiceStore.getState().updateParticipant('u1', { isSpeaking: true, isMuted: true });

    const updated = useVoiceStore.getState().participants.get('u1')!;
    expect(updated.isSpeaking).toBe(true);
    expect(updated.isMuted).toBe(true);
    expect(updated.username).toBe('User1'); // preserved
  });

  it('updateParticipant does nothing for non-existent user', () => {
    useVoiceStore.getState().updateParticipant('nonexistent', { isSpeaking: true });
    expect(useVoiceStore.getState().participants.size).toBe(0);
  });

  it('setParticipants replaces entire participants map', () => {
    const p1 = makeParticipant('u1', 'User1');
    const p2 = makeParticipant('u2', 'User2');

    useVoiceStore.getState().setParticipants([p1, p2]);

    const state = useVoiceStore.getState();
    expect(state.participants.size).toBe(2);
    expect(state.participants.get('u1')).toEqual(p1);
    expect(state.participants.get('u2')).toEqual(p2);
  });
});

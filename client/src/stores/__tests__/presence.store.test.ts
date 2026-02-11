import { describe, it, expect, beforeEach } from 'vitest';
import { usePresenceStore } from '../presence.store.js';

describe('usePresenceStore', () => {
  beforeEach(() => {
    usePresenceStore.setState({
      presences: new Map(),
    });
  });

  it('has empty presences initially', () => {
    expect(usePresenceStore.getState().presences.size).toBe(0);
  });

  it('setPresence sets a single user presence', () => {
    usePresenceStore.getState().setPresence('u1', 'online');
    expect(usePresenceStore.getState().presences.get('u1')).toBe('online');

    usePresenceStore.getState().setPresence('u1', 'idle');
    expect(usePresenceStore.getState().presences.get('u1')).toBe('idle');
  });

  it('bulkSetPresence sets multiple presences at once', () => {
    usePresenceStore.getState().bulkSetPresence([
      { userId: 'u1', status: 'online' },
      { userId: 'u2', status: 'dnd' },
      { userId: 'u3', status: 'offline' },
    ]);

    const presences = usePresenceStore.getState().presences;
    expect(presences.size).toBe(3);
    expect(presences.get('u1')).toBe('online');
    expect(presences.get('u2')).toBe('dnd');
    expect(presences.get('u3')).toBe('offline');
  });

  it('bulkSetPresence merges with existing presences', () => {
    usePresenceStore.getState().setPresence('u1', 'online');

    usePresenceStore.getState().bulkSetPresence([
      { userId: 'u2', status: 'idle' },
    ]);

    const presences = usePresenceStore.getState().presences;
    expect(presences.size).toBe(2);
    expect(presences.get('u1')).toBe('online');
    expect(presences.get('u2')).toBe('idle');
  });
});

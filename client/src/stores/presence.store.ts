import { create } from 'zustand';
import type { UserStatus } from '@harmonium/shared';

interface PresenceState {
  presences: Map<string, UserStatus>;

  setPresence: (userId: string, status: UserStatus) => void;
  bulkSetPresence: (entries: Array<{ userId: string; status: UserStatus }>) => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presences: new Map(),

  setPresence: (userId, status) => {
    const presences = new Map(get().presences);
    presences.set(userId, status);
    set({ presences });
  },

  bulkSetPresence: (entries) => {
    const presences = new Map(get().presences);
    for (const entry of entries) {
      presences.set(entry.userId, entry.status);
    }
    set({ presences });
  },
}));

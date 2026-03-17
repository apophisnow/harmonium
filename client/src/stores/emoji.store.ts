import { create } from 'zustand';
import { updateProfile } from '../api/users.js';

const DEFAULT_EMOJI = ['👍', '❤️', '😂', '🔥'];
const MAX_EMOJI = 4;

interface EmojiState {
  frequentEmoji: string[];
  recordEmoji: (emoji: string) => void;
  loadFromUser: (frequentEmoji: string[]) => void;
}

export const useEmojiStore = create<EmojiState>((set, get) => ({
  frequentEmoji: DEFAULT_EMOJI,

  loadFromUser: (frequentEmoji: string[]) => {
    if (frequentEmoji.length > 0) {
      set({ frequentEmoji: frequentEmoji.slice(0, MAX_EMOJI) });
    }
  },

  recordEmoji: (emoji: string) => {
    const prev = get().frequentEmoji;
    const filtered = prev.filter((e) => e !== emoji);
    const updated = [emoji, ...filtered].slice(0, MAX_EMOJI);

    // Skip if nothing changed
    if (updated.every((e, i) => e === prev[i]) && updated.length === prev.length) return;

    set({ frequentEmoji: updated });
    // Persist to server in background (fire-and-forget)
    updateProfile({ frequentEmoji: updated }).catch(() => {});
  },
}));

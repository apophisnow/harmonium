import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEmojiStore } from '../emoji.store.js';

// Mock the API call so recordEmoji doesn't hit the server
vi.mock('../../api/users.js', () => ({
  updateProfile: vi.fn().mockResolvedValue({}),
}));

describe('emoji store', () => {
  beforeEach(() => {
    useEmojiStore.setState({ frequentEmoji: ['👍', '❤️', '😂', '🔥'] });
  });

  it('has default emoji', () => {
    expect(useEmojiStore.getState().frequentEmoji).toEqual(['👍', '❤️', '😂', '🔥']);
  });

  it('recordEmoji adds emoji to front', () => {
    useEmojiStore.getState().recordEmoji('🎉');
    expect(useEmojiStore.getState().frequentEmoji).toEqual(['🎉', '👍', '❤️', '😂']);
  });

  it('recordEmoji deduplicates by moving existing emoji to front', () => {
    useEmojiStore.getState().recordEmoji('😂');
    expect(useEmojiStore.getState().frequentEmoji).toEqual(['😂', '👍', '❤️', '🔥']);
  });

  it('caps at 4 emoji', () => {
    useEmojiStore.getState().recordEmoji('🎉');
    useEmojiStore.getState().recordEmoji('✅');
    expect(useEmojiStore.getState().frequentEmoji).toHaveLength(4);
    expect(useEmojiStore.getState().frequentEmoji).toEqual(['✅', '🎉', '👍', '❤️']);
  });

  it('persists to server on recordEmoji', async () => {
    const { updateProfile } = await import('../../api/users.js');
    useEmojiStore.getState().recordEmoji('🎉');
    expect(updateProfile).toHaveBeenCalledWith({ frequentEmoji: ['🎉', '👍', '❤️', '😂'] });
  });

  it('recording same emoji twice keeps it at front without duplicates', () => {
    useEmojiStore.getState().recordEmoji('🎉');
    useEmojiStore.getState().recordEmoji('🎉');
    expect(useEmojiStore.getState().frequentEmoji).toEqual(['🎉', '👍', '❤️', '😂']);
  });

  it('loadFromUser sets emoji from server data', () => {
    useEmojiStore.getState().loadFromUser(['🤔', '💯', '🙏', '🫡']);
    expect(useEmojiStore.getState().frequentEmoji).toEqual(['🤔', '💯', '🙏', '🫡']);
  });

  it('loadFromUser ignores empty arrays', () => {
    useEmojiStore.getState().loadFromUser([]);
    expect(useEmojiStore.getState().frequentEmoji).toEqual(['👍', '❤️', '😂', '🔥']);
  });
});

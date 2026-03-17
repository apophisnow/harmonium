import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMessageStore } from '../message.store.js';

vi.mock('../../api/messages.js', () => ({
  getMessages: vi.fn(),
  getPinnedMessages: vi.fn(),
}));

import { getMessages, getPinnedMessages } from '../../api/messages.js';

const makeMessage = (id: string, channelId: string, content: string, pinned = false) => ({
  id,
  channelId,
  authorId: 'user-1',
  content,
  editedAt: null,
  isDeleted: false,
  isPinned: pinned,
  pinnedAt: pinned ? '2025-01-01T12:00:00Z' : null,
  pinnedBy: pinned ? 'user-1' : null,
  replyToId: null,
  createdAt: '2025-01-01T00:00:00Z',
});

describe('useMessageStore', () => {
  beforeEach(() => {
    useMessageStore.setState({
      messages: new Map(),
      hasMore: new Map(),
      replyingTo: null,
      pinnedMessages: new Map(),
    });
    vi.clearAllMocks();
  });

  it('fetchMessages populates messages for a channel (initial load)', async () => {
    const msgs = [makeMessage('m1', 'c1', 'Hello'), makeMessage('m2', 'c1', 'World')];
    vi.mocked(getMessages).mockResolvedValue(msgs);

    await useMessageStore.getState().fetchMessages('c1');

    const state = useMessageStore.getState();
    expect(getMessages).toHaveBeenCalledWith('c1', { before: undefined, limit: 50 });
    expect(state.messages.get('c1')).toEqual(msgs);
    expect(state.hasMore.get('c1')).toBe(false); // 2 < 50
  });

  it('fetchMessages sets hasMore to true when full page returned', async () => {
    const msgs = Array.from({ length: 50 }, (_, i) =>
      makeMessage(`m${i}`, 'c1', `Message ${i}`),
    );
    vi.mocked(getMessages).mockResolvedValue(msgs);

    await useMessageStore.getState().fetchMessages('c1');

    expect(useMessageStore.getState().hasMore.get('c1')).toBe(true);
  });

  it('fetchMessages with before prepends older messages to existing', async () => {
    const existing = [makeMessage('m3', 'c1', 'Existing')];
    useMessageStore.setState({
      messages: new Map([['c1', existing]]),
      hasMore: new Map(),
    });

    const older = [makeMessage('m1', 'c1', 'Older'), makeMessage('m2', 'c1', 'Also older')];
    vi.mocked(getMessages).mockResolvedValue(older);

    await useMessageStore.getState().fetchMessages('c1', 'm3');

    const state = useMessageStore.getState();
    expect(getMessages).toHaveBeenCalledWith('c1', { before: 'm3', limit: 50 });
    expect(state.messages.get('c1')).toEqual([...older, ...existing]);
  });

  it('addMessage appends message to channel list', () => {
    const msg = makeMessage('m1', 'c1', 'Hello');
    useMessageStore.getState().addMessage(msg);

    expect(useMessageStore.getState().messages.get('c1')).toEqual([msg]);

    const msg2 = makeMessage('m2', 'c1', 'World');
    useMessageStore.getState().addMessage(msg2);

    expect(useMessageStore.getState().messages.get('c1')).toEqual([msg, msg2]);
  });

  it('updateMessage merges partial update into existing message', () => {
    const msg = makeMessage('m1', 'c1', 'Hello');
    useMessageStore.setState({
      messages: new Map([['c1', [msg]]]),
    });

    useMessageStore.getState().updateMessage({
      id: 'm1',
      channelId: 'c1',
      content: 'Hello edited',
      editedAt: '2025-01-02T00:00:00Z',
    });

    const updated = useMessageStore.getState().messages.get('c1')![0];
    expect(updated.content).toBe('Hello edited');
    expect(updated.editedAt).toBe('2025-01-02T00:00:00Z');
    expect(updated.authorId).toBe('user-1'); // preserved from original
  });

  it('deleteMessage removes message from channel list', () => {
    const msg1 = makeMessage('m1', 'c1', 'Hello');
    const msg2 = makeMessage('m2', 'c1', 'World');
    useMessageStore.setState({
      messages: new Map([['c1', [msg1, msg2]]]),
    });

    useMessageStore.getState().deleteMessage('c1', 'm1');

    const state = useMessageStore.getState();
    expect(state.messages.get('c1')).toEqual([msg2]);
  });

  it('setReplyingTo sets the message being replied to', () => {
    const msg = makeMessage('m1', 'c1', 'Hello');
    useMessageStore.getState().setReplyingTo(msg);

    expect(useMessageStore.getState().replyingTo).toEqual(msg);
  });

  it('setReplyingTo clears reply when set to null', () => {
    const msg = makeMessage('m1', 'c1', 'Hello');
    useMessageStore.getState().setReplyingTo(msg);
    useMessageStore.getState().setReplyingTo(null);

    expect(useMessageStore.getState().replyingTo).toBeNull();
  });

  describe('pinned messages', () => {
    it('fetchPinnedMessages populates pinnedMessages for a channel', async () => {
      const pinned = [
        makeMessage('m1', 'c1', 'Pinned 1', true),
        makeMessage('m2', 'c1', 'Pinned 2', true),
      ];
      vi.mocked(getPinnedMessages).mockResolvedValue(pinned);

      await useMessageStore.getState().fetchPinnedMessages('c1');

      const state = useMessageStore.getState();
      expect(getPinnedMessages).toHaveBeenCalledWith('c1');
      expect(state.pinnedMessages.get('c1')).toEqual(pinned);
    });

    it('fetchPinnedMessages replaces existing pinned messages', async () => {
      const old = [makeMessage('m1', 'c1', 'Old pin', true)];
      useMessageStore.setState({
        pinnedMessages: new Map([['c1', old]]),
      });

      const fresh = [makeMessage('m2', 'c1', 'New pin', true)];
      vi.mocked(getPinnedMessages).mockResolvedValue(fresh);

      await useMessageStore.getState().fetchPinnedMessages('c1');

      expect(useMessageStore.getState().pinnedMessages.get('c1')).toEqual(fresh);
    });

    it('handlePinMessage adds message to pinnedMessages and updates main list', () => {
      const msg = makeMessage('m1', 'c1', 'Hello');
      useMessageStore.setState({
        messages: new Map([['c1', [msg]]]),
        pinnedMessages: new Map(),
      });

      const pinnedMsg = { ...msg, isPinned: true, pinnedAt: '2025-01-01T12:00:00Z', pinnedBy: 'user-2' };
      useMessageStore.getState().handlePinMessage('c1', pinnedMsg);

      const state = useMessageStore.getState();
      // Main list updated
      const updated = state.messages.get('c1')![0];
      expect(updated.isPinned).toBe(true);
      expect(updated.pinnedBy).toBe('user-2');
      // Pinned list populated
      expect(state.pinnedMessages.get('c1')).toEqual([pinnedMsg]);
    });

    it('handlePinMessage does not duplicate already-pinned message', () => {
      const pinnedMsg = makeMessage('m1', 'c1', 'Hello', true);
      useMessageStore.setState({
        messages: new Map([['c1', [pinnedMsg]]]),
        pinnedMessages: new Map([['c1', [pinnedMsg]]]),
      });

      useMessageStore.getState().handlePinMessage('c1', pinnedMsg);

      expect(useMessageStore.getState().pinnedMessages.get('c1')).toHaveLength(1);
    });

    it('handlePinMessage prepends new pin to existing pinned list', () => {
      const existing = makeMessage('m1', 'c1', 'First pin', true);
      useMessageStore.setState({
        messages: new Map([['c1', [existing, makeMessage('m2', 'c1', 'Second')]]]),
        pinnedMessages: new Map([['c1', [existing]]]),
      });

      const newPin = { ...makeMessage('m2', 'c1', 'Second'), isPinned: true, pinnedAt: '2025-01-02T00:00:00Z', pinnedBy: 'user-1' };
      useMessageStore.getState().handlePinMessage('c1', newPin);

      const pinned = useMessageStore.getState().pinnedMessages.get('c1')!;
      expect(pinned).toHaveLength(2);
      expect(pinned[0].id).toBe('m2'); // newest first
      expect(pinned[1].id).toBe('m1');
    });

    it('handleUnpinMessage removes from pinnedMessages and updates main list', () => {
      const msg = makeMessage('m1', 'c1', 'Hello', true);
      useMessageStore.setState({
        messages: new Map([['c1', [msg]]]),
        pinnedMessages: new Map([['c1', [msg]]]),
      });

      useMessageStore.getState().handleUnpinMessage('c1', 'm1');

      const state = useMessageStore.getState();
      // Main list updated
      const updated = state.messages.get('c1')![0];
      expect(updated.isPinned).toBe(false);
      expect(updated.pinnedAt).toBeNull();
      expect(updated.pinnedBy).toBeNull();
      // Removed from pinned list
      expect(state.pinnedMessages.get('c1')).toEqual([]);
    });

    it('handleUnpinMessage only removes the target message', () => {
      const msg1 = makeMessage('m1', 'c1', 'Pin 1', true);
      const msg2 = makeMessage('m2', 'c1', 'Pin 2', true);
      useMessageStore.setState({
        messages: new Map([['c1', [msg1, msg2]]]),
        pinnedMessages: new Map([['c1', [msg1, msg2]]]),
      });

      useMessageStore.getState().handleUnpinMessage('c1', 'm1');

      const pinned = useMessageStore.getState().pinnedMessages.get('c1')!;
      expect(pinned).toHaveLength(1);
      expect(pinned[0].id).toBe('m2');
    });
  });
});

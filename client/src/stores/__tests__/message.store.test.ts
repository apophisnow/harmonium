import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMessageStore } from '../message.store.js';

vi.mock('../../api/messages.js', () => ({
  getMessages: vi.fn(),
}));

import { getMessages } from '../../api/messages.js';

const makeMessage = (id: string, channelId: string, content: string) => ({
  id,
  channelId,
  authorId: 'user-1',
  content,
  editedAt: null,
  isDeleted: false,
  replyToId: null,
  createdAt: '2025-01-01T00:00:00Z',
});

describe('useMessageStore', () => {
  beforeEach(() => {
    useMessageStore.setState({
      messages: new Map(),
      hasMore: new Map(),
      replyingTo: null,
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
});

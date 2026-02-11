import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInfiniteMessages } from '../useInfiniteMessages.js';
import { useMessageStore } from '../../stores/message.store.js';

// Mock the API module that the message store imports
vi.mock('../../api/messages.js', () => ({
  getMessages: vi.fn().mockResolvedValue([]),
}));

describe('useInfiniteMessages', () => {
  beforeEach(() => {
    // Reset message store to initial state
    useMessageStore.setState({
      messages: new Map(),
      hasMore: new Map(),
    });
  });

  it('returns empty messages and hasMore=false for null channelId', () => {
    const { result } = renderHook(() => useInfiniteMessages(null));

    expect(result.current.messages).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('fetches messages on channelId change', async () => {
    const fetchMessages = vi.fn().mockResolvedValue(undefined);
    useMessageStore.setState({ fetchMessages });

    const { result } = renderHook(() => useInfiniteMessages('channel-1'));

    await waitFor(() => {
      expect(fetchMessages).toHaveBeenCalledWith('channel-1');
    });

    // isLoading should eventually be false after fetch completes
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('returns messages from store for a given channelId', async () => {
    const testMessages = [
      {
        id: 'msg-1',
        channelId: 'channel-1',
        authorId: 'user-1',
        content: 'Hello',
        editedAt: null,
        isDeleted: false,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-2',
        channelId: 'channel-1',
        authorId: 'user-2',
        content: 'World',
        editedAt: null,
        isDeleted: false,
        createdAt: '2024-01-01T00:01:00Z',
      },
    ];

    const messages = new Map();
    messages.set('channel-1', testMessages);

    const fetchMessages = vi.fn().mockResolvedValue(undefined);
    useMessageStore.setState({ messages, fetchMessages });

    const { result } = renderHook(() => useInfiniteMessages('channel-1'));

    expect(result.current.messages).toEqual(testMessages);
    expect(result.current.messages).toHaveLength(2);
  });

  it('hasMore reflects store state', async () => {
    const hasMore = new Map();
    hasMore.set('channel-1', true);
    hasMore.set('channel-2', false);

    const fetchMessages = vi.fn().mockResolvedValue(undefined);
    useMessageStore.setState({ hasMore, fetchMessages });

    const { result: result1 } = renderHook(() => useInfiniteMessages('channel-1'));
    expect(result1.current.hasMore).toBe(true);

    const { result: result2 } = renderHook(() => useInfiniteMessages('channel-2'));
    expect(result2.current.hasMore).toBe(false);
  });

  it('loadMore calls fetchMessages with before cursor', async () => {
    const testMessages = [
      {
        id: 'msg-1',
        channelId: 'channel-1',
        authorId: 'user-1',
        content: 'First message',
        editedAt: null,
        isDeleted: false,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const messages = new Map();
    messages.set('channel-1', testMessages);

    const hasMore = new Map();
    hasMore.set('channel-1', true);

    const fetchMessages = vi.fn().mockResolvedValue(undefined);
    useMessageStore.setState({ messages, hasMore, fetchMessages });

    const { result } = renderHook(() => useInfiniteMessages('channel-1'));

    // Wait for initial fetch to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Call loadMore
    await act(async () => {
      await result.current.loadMore();
    });

    // Should have been called with channelId and the first message's id as cursor
    expect(fetchMessages).toHaveBeenCalledWith('channel-1', 'msg-1');
  });
});

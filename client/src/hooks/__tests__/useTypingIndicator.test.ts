import { describe, it, expect, vi, type Mock, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ClientEvent } from '@harmonium/shared';
import { useTypingIndicator } from '../useTypingIndicator.js';
import { useAuthStore } from '../../stores/auth.store.js';

// Mock localStorage to prevent Node.js 22 built-in conflict with jsdom
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
  get length() {
    return storage.size;
  },
  key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
});

describe('useTypingIndicator', () => {
  let sendEvent: Mock<(event: ClientEvent) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    sendEvent = vi.fn<(event: ClientEvent) => void>();
    storage.clear();
    useAuthStore.setState({
      user: { id: 'current-user', username: 'me', discriminator: '0001', avatarUrl: null, aboutMe: null, status: 'online' as const, customStatus: null, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sendTyping fires TYPING_START event via sendEvent', () => {
    const { result } = renderHook(() => useTypingIndicator('channel-1', sendEvent));

    act(() => {
      result.current.sendTyping();
    });

    expect(sendEvent).toHaveBeenCalledWith({
      op: 'TYPING_START',
      d: { channelId: 'channel-1' },
    });
  });

  it('sendTyping is throttled (second call within 5s is ignored)', () => {
    const { result } = renderHook(() => useTypingIndicator('channel-1', sendEvent));

    act(() => {
      result.current.sendTyping();
    });
    expect(sendEvent).toHaveBeenCalledTimes(1);

    // Call again immediately - should be throttled
    act(() => {
      result.current.sendTyping();
    });
    expect(sendEvent).toHaveBeenCalledTimes(1);

    // Advance time past 5s throttle
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    act(() => {
      result.current.sendTyping();
    });
    expect(sendEvent).toHaveBeenCalledTimes(2);
  });

  it('typing users received via window event are tracked', () => {
    const { result } = renderHook(() => useTypingIndicator('channel-1', sendEvent));

    expect(result.current.typingUsers).toEqual([]);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ws:typing_start', {
          detail: {
            channelId: 'channel-1',
            userId: 'user-2',
            username: 'other-user',
            timestamp: Date.now(),
          },
        }),
      );
    });

    expect(result.current.typingUsers).toHaveLength(1);
    expect(result.current.typingUsers[0].userId).toBe('user-2');
    expect(result.current.typingUsers[0].username).toBe('other-user');
  });

  it('self-typing events (matching currentUserId) are filtered out', () => {
    const { result } = renderHook(() => useTypingIndicator('channel-1', sendEvent));

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ws:typing_start', {
          detail: {
            channelId: 'channel-1',
            userId: 'current-user', // matches the auth store user id
            username: 'me',
            timestamp: Date.now(),
          },
        }),
      );
    });

    // Should not add self to typing users
    expect(result.current.typingUsers).toEqual([]);
  });

  it('typing users expire after 10s', () => {
    const { result } = renderHook(() => useTypingIndicator('channel-1', sendEvent));

    const now = Date.now();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ws:typing_start', {
          detail: {
            channelId: 'channel-1',
            userId: 'user-2',
            username: 'other-user',
            timestamp: now,
          },
        }),
      );
    });

    expect(result.current.typingUsers).toHaveLength(1);

    // Advance time past the 10s expiration plus one interval tick (1s)
    act(() => {
      vi.advanceTimersByTime(11_000);
    });

    expect(result.current.typingUsers).toHaveLength(0);
  });
});

import { useEffect, useRef, useCallback, useState } from 'react';
import type { ClientEvent } from '@harmonium/shared';
import { useAuthStore } from '../stores/auth.store.js';

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

const TYPING_EXPIRE_MS = 10_000;
const TYPING_THROTTLE_MS = 5_000;

export function useTypingIndicator(
  channelId: string | null,
  sendEvent: (event: ClientEvent) => void,
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingMapRef = useRef<Map<string, TypingUser>>(new Map());
  const lastSentRef = useRef(0);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Listen for typing events from WebSocket (via window custom events)
  useEffect(() => {
    if (!channelId) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        channelId: string;
        userId: string;
        username: string;
        timestamp: number;
      };

      if (detail.channelId !== channelId) return;
      if (detail.userId === currentUserId) return;

      typingMapRef.current.set(detail.userId, {
        userId: detail.userId,
        username: detail.username,
        timestamp: detail.timestamp,
      });
      setTypingUsers(Array.from(typingMapRef.current.values()));
    };

    window.addEventListener('ws:typing_start', handler);
    return () => window.removeEventListener('ws:typing_start', handler);
  }, [channelId, currentUserId]);

  // Expire old typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [key, value] of typingMapRef.current) {
        if (now - value.timestamp > TYPING_EXPIRE_MS) {
          typingMapRef.current.delete(key);
          changed = true;
        }
      }
      if (changed) {
        setTypingUsers(Array.from(typingMapRef.current.values()));
      }
    }, 1_000);

    return () => clearInterval(interval);
  }, []);

  // Clear typing users when channel changes
  useEffect(() => {
    typingMapRef.current.clear();
    setTypingUsers([]);
  }, [channelId]);

  const sendTyping = useCallback(() => {
    if (!channelId) return;
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    sendEvent({ op: 'TYPING_START', d: { channelId } });
  }, [channelId, sendEvent]);

  return { typingUsers, sendTyping };
}

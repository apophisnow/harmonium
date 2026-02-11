import { useEffect, useCallback, useState } from 'react';
import type { Message } from '@harmonium/shared';
import { useMessageStore } from '../stores/message.store.js';

const EMPTY_MESSAGES: Message[] = [];

export function useInfiniteMessages(channelId: string | null) {
  const messages = useMessageStore((s) =>
    channelId ? (s.messages.get(channelId) ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const hasMore = useMessageStore((s) =>
    channelId ? (s.hasMore.get(channelId) ?? true) : false,
  );
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const [isLoading, setIsLoading] = useState(false);

  // Load initial messages when channel changes
  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        await fetchMessages(channelId);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [channelId, fetchMessages]);

  const loadMore = useCallback(async () => {
    if (!channelId || !hasMore || isLoading) return;

    const firstMessage = messages[0];
    if (!firstMessage) return;

    setIsLoading(true);
    try {
      await fetchMessages(channelId, firstMessage.id);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [channelId, hasMore, isLoading, messages, fetchMessages]);

  return { messages, isLoading, hasMore, loadMore };
}

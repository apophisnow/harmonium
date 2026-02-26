import { useEffect, useRef, useCallback } from 'react';
import type { Message, ClientEvent } from '@harmonium/shared';
import { MessageItem } from './MessageItem.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';
import { useUnreadStore } from '../../stores/unread.store.js';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  channelId?: string;
  sendEvent?: (event: ClientEvent) => void;
}

export function MessageList({
  messages,
  isLoading,
  hasMore,
  loadMore,
  channelId,
  sendEvent,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const isAutoScrollRef = useRef(true);
  const lastMarkedReadRef = useRef<string | null>(null);

  const lastReadMessageId = useUnreadStore(
    (s) => channelId ? (s.readStates.get(channelId)?.lastReadMessageId ?? null) : null,
  );
  const markRead = useUnreadStore((s) => s.markRead);

  // Mark channel as read when near bottom and there are messages
  const markAsRead = useCallback(() => {
    if (!channelId || !sendEvent || messages.length === 0) return;
    const latestId = messages[messages.length - 1].id;
    if (latestId === lastMarkedReadRef.current) return;

    lastMarkedReadRef.current = latestId;
    markRead(channelId, latestId);
    sendEvent({ op: 'MARK_READ', d: { channelId, messageId: latestId } });
  }, [channelId, sendEvent, messages, markRead]);

  // Check if user is near the bottom (within 100px)
  const isNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100
    );
  }, []);

  // Scroll to bottom when new messages arrive (if user was already at bottom)
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Mark as read since we auto-scrolled to bottom
      markAsRead();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, markAsRead]);

  // Initial scroll to bottom + mark as read when channel loads
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
    lastMarkedReadRef.current = null;
    // Delay mark-as-read slightly to ensure messages are loaded
    const timer = setTimeout(() => {
      markAsRead();
    }, 100);
    return () => clearTimeout(timer);
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    // Track if user is at bottom for auto-scroll behavior
    isAutoScrollRef.current = isNearBottom();

    // Mark as read when user scrolls to bottom
    if (isAutoScrollRef.current) {
      markAsRead();
    }

    // Infinite scroll: load more when scrolled near top
    if (container.scrollTop < 100 && hasMore && !isLoading) {
      const prevHeight = container.scrollHeight;
      void loadMore().then(() => {
        // Preserve scroll position after loading older messages
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop =
              containerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  };

  // Group consecutive messages from same author within 5 minutes
  const isGrouped = (msg: Message, prevMsg: Message | undefined): boolean => {
    if (!prevMsg) return false;
    if (msg.authorId !== prevMsg.authorId) return false;
    const timeDiff =
      new Date(msg.createdAt).getTime() -
      new Date(prevMsg.createdAt).getTime();
    return timeDiff < 5 * 60 * 1000;
  };

  // Find the index where the "New" divider should appear
  const newDividerIndex = (() => {
    if (!lastReadMessageId || messages.length === 0) return -1;
    const lastReadBigInt = BigInt(lastReadMessageId);
    for (let i = 0; i < messages.length; i++) {
      if (BigInt(messages[i].id) > lastReadBigInt) {
        return i;
      }
    }
    return -1;
  })();

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
    >
      {/* Load more indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size={24} className="text-th-brand" />
        </div>
      )}

      {!hasMore && messages.length > 0 && (
        <div className="px-4 pb-4 pt-8">
          <h3 className="text-2xl font-bold text-white">
            Welcome to the beginning!
          </h3>
          <p className="text-sm text-th-text-secondary">
            This is the start of this channel.
          </p>
        </div>
      )}

      {messages.length === 0 && !isLoading && (
        <div className="flex h-full items-center justify-center">
          <p className="text-th-text-secondary">
            No messages yet. Start the conversation!
          </p>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={msg.id}>
          {i === newDividerIndex && (
            <div className="mx-4 my-2 flex items-center gap-2">
              <div className="flex-1 border-t border-th-red" />
              <span className="text-xs font-semibold text-th-red">NEW</span>
              <div className="flex-1 border-t border-th-red" />
            </div>
          )}
          <MessageItem
            message={msg}
            isGrouped={i === newDividerIndex ? false : isGrouped(msg, messages[i - 1])}
          />
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}

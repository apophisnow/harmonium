import { useEffect, useRef, useCallback } from 'react';
import type { Message } from '@harmonium/shared';
import { MessageItem } from './MessageItem.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function MessageList({
  messages,
  isLoading,
  hasMore,
  loadMore,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const isAutoScrollRef = useRef(true);

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
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    // Track if user is at bottom for auto-scroll behavior
    isAutoScrollRef.current = isNearBottom();

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

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
    >
      {/* Load more indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size={24} className="text-[#5865f2]" />
        </div>
      )}

      {!hasMore && messages.length > 0 && (
        <div className="px-4 pb-4 pt-8">
          <h3 className="text-2xl font-bold text-white">
            Welcome to the beginning!
          </h3>
          <p className="text-sm text-[#96989d]">
            This is the start of this channel.
          </p>
        </div>
      )}

      {messages.length === 0 && !isLoading && (
        <div className="flex h-full items-center justify-center">
          <p className="text-[#96989d]">
            No messages yet. Start the conversation!
          </p>
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageItem
          key={msg.id}
          message={msg}
          isGrouped={isGrouped(msg, messages[i - 1])}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}

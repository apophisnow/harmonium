import { useEffect } from 'react';
import type { ClientEvent } from '@harmonium/shared';
import { useThreadStore } from '../../stores/thread.store.js';
import { useInfiniteMessages } from '../../hooks/useInfiniteMessages.js';
import { useTypingIndicator } from '../../hooks/useTypingIndicator.js';
import { MessageList } from '../chat/MessageList.js';
import { MessageInput } from '../chat/MessageInput.js';
import { TypingIndicator } from '../chat/TypingIndicator.js';
import { archiveThread, unarchiveThread, joinThread, leaveThread } from '../../api/threads.js';

interface ThreadPanelProps {
  sendEvent: (event: ClientEvent) => void;
  serverId: string;
}

export function ThreadPanel({ sendEvent, serverId }: ThreadPanelProps) {
  const activeThread = useThreadStore((s) => s.activeThread);
  const setActiveThread = useThreadStore((s) => s.setActiveThread);
  const markThreadLeft = useThreadStore((s) => s.markThreadLeft);

  const threadId = activeThread?.id ?? null;

  const { messages, isLoading, hasMore, loadMore } =
    useInfiniteMessages(threadId);
  const { typingUsers, sendTyping } = useTypingIndicator(
    threadId,
    sendEvent,
  );

  // Join thread automatically when opening (also re-joins if previously left)
  useEffect(() => {
    if (threadId) {
      joinThread(threadId).catch(() => {});
      // Clear left state so it reappears in sidebar
      if (useThreadStore.getState().leftThreadIds.has(threadId)) {
        const leftThreadIds = new Set(useThreadStore.getState().leftThreadIds);
        leftThreadIds.delete(threadId);
        useThreadStore.setState({ leftThreadIds });
      }
    }
  }, [threadId]);

  if (!activeThread) return null;

  const handleClose = () => {
    setActiveThread(null);
  };

  const handleLeave = async () => {
    try {
      await leaveThread(activeThread.id);
      markThreadLeft(activeThread.id);
    } catch {
      console.error('Failed to leave thread');
    }
  };

  const handleArchiveToggle = async () => {
    try {
      if (activeThread.threadArchived) {
        const updated = await unarchiveThread(activeThread.id);
        setActiveThread(updated);
      } else {
        const updated = await archiveThread(activeThread.id);
        setActiveThread(updated);
      }
    } catch {
      console.error('Failed to toggle thread archive');
    }
  };

  return (
    <div className="flex h-full w-[420px] flex-shrink-0 flex-col border-l border-th-border bg-th-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-th-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-th-text-primary">
            Thread
          </h3>
          <p className="truncate text-xs text-th-text-secondary">
            #{activeThread.name}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleArchiveToggle}
            className="rounded p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-accent transition-colors"
            title={activeThread.threadArchived ? 'Unarchive thread' : 'Archive thread'}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" />
            </svg>
          </button>
          <button
            onClick={handleLeave}
            className="rounded p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-accent transition-colors"
            title="Leave thread"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="rounded p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-accent transition-colors"
            title="Close thread"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Thread archived banner */}
      {activeThread.threadArchived && (
        <div className="flex items-center justify-center bg-th-bg-accent px-4 py-2 text-sm text-th-text-secondary">
          This thread is archived.
          <button
            onClick={handleArchiveToggle}
            className="ml-2 text-th-brand hover:underline"
          >
            Unarchive
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          hasMore={hasMore}
          loadMore={loadMore}
          channelId={activeThread.id}
          sendEvent={sendEvent}
        />
        <TypingIndicator typingUsers={typingUsers} />
      </div>

      {/* Input */}
      {!activeThread.threadArchived && (
        <MessageInput
          channelId={activeThread.id}
          channelName={activeThread.name}
          serverId={serverId}
          onTyping={sendTyping}
        />
      )}
    </div>
  );
}

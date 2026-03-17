import { useEffect } from 'react';
import type { ThreadListItem } from '@harmonium/shared';
import { useThreadStore } from '../../stores/thread.store.js';
import { getThread } from '../../api/threads.js';
import { formatDate } from '../../lib/formatters.js';

const EMPTY_THREADS: ThreadListItem[] = [];

interface ThreadListProps {
  channelId: string;
  onClose: () => void;
}

function ThreadListItem({
  thread,
  onOpen,
}: {
  thread: ThreadListItem;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full cursor-pointer items-center gap-3 rounded px-3 py-2 text-left hover:bg-th-bg-message-hover transition-colors"
    >
      <svg className="h-5 w-5 flex-shrink-0 text-th-text-muted" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H18L22 24V6ZM20 6V17.17L18.83 16H4V6H20ZM6 12H18V14H6V12ZM6 9H18V11H6V9Z" />
      </svg>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-th-text-primary">
          {thread.name}
        </span>
        <span className="text-xs text-th-text-muted">
          {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
          {thread.lastMessageAt && (
            <> &middot; {formatDate(thread.lastMessageAt)}</>
          )}
        </span>
      </div>
    </button>
  );
}

export function ThreadList({ channelId, onClose }: ThreadListProps) {
  const threads = useThreadStore((s) => s.threads.get(channelId) ?? EMPTY_THREADS);
  const fetchThreads = useThreadStore((s) => s.fetchThreads);
  const setActiveThread = useThreadStore((s) => s.setActiveThread);

  useEffect(() => {
    fetchThreads(channelId);
  }, [channelId, fetchThreads]);

  const activeThreads = threads.filter((t) => !t.threadArchived);

  const handleOpenThread = async (threadItem: ThreadListItem) => {
    try {
      const thread = await getThread(threadItem.id);
      setActiveThread(thread);
      onClose();
    } catch {
      console.error('Failed to open thread');
    }
  };

  return (
    <div className="flex h-full w-[340px] flex-shrink-0 flex-col border-l border-th-border bg-th-bg-secondary">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-th-border px-4">
        <h3 className="font-semibold text-white">Threads</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-accent transition-colors"
          title="Close"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="h-10 w-10 text-th-text-muted mb-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H18L22 24V6ZM20 6V17.17L18.83 16H4V6H20ZM6 12H18V14H6V12ZM6 9H18V11H6V9Z" />
            </svg>
            <p className="text-sm text-th-text-secondary">
              No active threads
            </p>
            <p className="mt-1 text-xs text-th-text-muted">
              Right-click a message to create a thread
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {activeThreads.map((thread) => (
              <ThreadListItem
                key={thread.id}
                thread={thread}
                onOpen={() => handleOpenThread(thread)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

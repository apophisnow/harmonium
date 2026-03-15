import { useEffect } from 'react';
import type { ThreadListItem } from '@harmonium/shared';
import { useThreadStore } from '../../stores/thread.store.js';
import { getThread } from '../../api/threads.js';

const EMPTY_THREADS: ThreadListItem[] = [];

interface ThreadListProps {
  channelId: string;
}

export function ThreadList({ channelId }: ThreadListProps) {
  const threads = useThreadStore((s) => s.threads.get(channelId) ?? EMPTY_THREADS);
  const fetchThreads = useThreadStore((s) => s.fetchThreads);
  const setActiveThread = useThreadStore((s) => s.setActiveThread);

  useEffect(() => {
    fetchThreads(channelId);
  }, [channelId, fetchThreads]);

  const activeThreads = threads.filter((t) => !t.threadArchived);

  if (activeThreads.length === 0) return null;

  const handleOpenThread = async (threadItem: ThreadListItem) => {
    try {
      const thread = await getThread(threadItem.id);
      setActiveThread(thread);
    } catch {
      console.error('Failed to open thread');
    }
  };

  return (
    <div className="border-t border-th-border px-4 py-2">
      <h4 className="mb-1 text-xs font-semibold uppercase text-th-text-muted">
        Threads
      </h4>
      <div className="flex flex-col gap-1">
        {activeThreads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => handleOpenThread(thread)}
            className="flex items-center justify-between rounded px-2 py-1.5 text-left text-sm text-th-text-secondary hover:bg-th-bg-accent hover:text-th-text-primary transition-colors"
          >
            <span className="truncate font-medium">#{thread.name}</span>
            <span className="ml-2 flex-shrink-0 text-xs text-th-text-muted">
              {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

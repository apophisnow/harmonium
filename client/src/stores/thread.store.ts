import { create } from 'zustand';
import type { Channel, ThreadListItem } from '@harmonium/shared';
import { getThreads } from '../api/threads.js';

interface ThreadState {
  // Map of parentChannelId -> list of threads
  threads: Map<string, ThreadListItem[]>;
  // Currently open thread (shown in side panel)
  activeThread: Channel | null;
  // Threads the user has left (hidden from sidebar, still visible inline)
  leftThreadIds: Set<string>;

  fetchThreads: (channelId: string) => Promise<void>;
  setActiveThread: (thread: Channel | null) => void;
  addThread: (thread: Channel) => void;
  updateThread: (thread: Channel) => void;
  removeThread: (threadId: string, parentChannelId: string) => void;
  markThreadLeft: (threadId: string) => void;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  threads: new Map(),
  activeThread: null,
  leftThreadIds: new Set(),

  fetchThreads: async (channelId) => {
    const threadList = await getThreads(channelId);
    const threads = new Map(get().threads);
    threads.set(channelId, threadList);
    set({ threads });
  },

  setActiveThread: (thread) => {
    set({ activeThread: thread });
  },

  addThread: (thread) => {
    if (!thread.parentChannelId) return;
    const threads = new Map(get().threads);
    const parentId = thread.parentChannelId;
    const list = threads.get(parentId) ?? [];
    // Re-joining a previously left thread
    const leftThreadIds = new Set(get().leftThreadIds);
    leftThreadIds.delete(thread.id);
    if (list.some((t) => t.id === thread.id)) {
      set({ leftThreadIds });
      return;
    }
    const item: ThreadListItem = {
      id: thread.id,
      name: thread.name,
      parentChannelId: thread.parentChannelId ?? '',
      originMessageId: thread.originMessageId ?? '',
      threadArchived: thread.threadArchived ?? false,
      lastMessageAt: thread.lastMessageAt ?? null,
      messageCount: thread.messageCount ?? 0,
      createdAt: thread.createdAt,
    };
    threads.set(parentId, [item, ...list]);
    set({ threads, leftThreadIds });
  },

  updateThread: (thread) => {
    if (!thread.parentChannelId) return;
    const threads = new Map(get().threads);
    const parentId = thread.parentChannelId;
    const list = threads.get(parentId) ?? [];
    threads.set(
      parentId,
      list.map((t) =>
        t.id === thread.id
          ? {
              id: thread.id,
              name: thread.name,
              parentChannelId: thread.parentChannelId ?? '',
              originMessageId: thread.originMessageId ?? '',
              threadArchived: thread.threadArchived ?? false,
              lastMessageAt: thread.lastMessageAt ?? null,
              messageCount: thread.messageCount ?? 0,
              createdAt: thread.createdAt,
            }
          : t,
      ),
    );
    // Update active thread if it's the one being updated
    const active = get().activeThread;
    if (active && active.id === thread.id) {
      set({ threads, activeThread: thread });
    } else {
      set({ threads });
    }
  },

  markThreadLeft: (threadId) => {
    const leftThreadIds = new Set(get().leftThreadIds);
    leftThreadIds.add(threadId);
    const active = get().activeThread;
    if (active && active.id === threadId) {
      set({ leftThreadIds, activeThread: null });
    } else {
      set({ leftThreadIds });
    }
  },

  removeThread: (threadId, parentChannelId) => {
    const threads = new Map(get().threads);
    const list = threads.get(parentChannelId) ?? [];
    threads.set(
      parentChannelId,
      list.filter((t) => t.id !== threadId),
    );
    const active = get().activeThread;
    if (active && active.id === threadId) {
      set({ threads, activeThread: null });
    } else {
      set({ threads });
    }
  },
}));

import { useEffect } from 'react';
import type { Message } from '@harmonium/shared';
import { useMessageStore } from '../../stores/message.store.js';
import { unpinMessage } from '../../api/messages.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { formatDate } from '../../lib/formatters.js';

interface PinnedMessagesProps {
  channelId: string;
  onClose: () => void;
  canUnpin: boolean;
}

function PinnedMessageItem({
  message,
  canUnpin,
  onClose,
}: {
  message: Message;
  canUnpin: boolean;
  onClose: () => void;
}) {
  const handleScrollTo = () => {
    const el = document.querySelector(`[data-message-id="${message.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-th-bg-message-hover');
      setTimeout(() => el.classList.remove('bg-th-bg-message-hover'), 1500);
      onClose();
    }
  };

  const handleUnpin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await unpinMessage(message.channelId, message.id);
    } catch {
      console.error('Failed to unpin message');
    }
  };

  return (
    <div
      className="group flex cursor-pointer gap-3 rounded px-3 py-2 hover:bg-th-bg-message-hover transition-colors"
      onClick={handleScrollTo}
    >
      <div className="flex-shrink-0 pt-0.5">
        <UserAvatar
          username={message.author?.username ?? 'Unknown'}
          avatarUrl={message.author?.avatarUrl}
          size={32}
          showStatus={false}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white">
            {message.author?.username ?? 'Unknown'}
          </span>
          <span className="text-xs text-th-text-muted">
            {formatDate(message.createdAt)}
          </span>
        </div>
        {message.content && (
          <p className="mt-0.5 text-sm text-th-text-secondary break-words line-clamp-3">
            {message.content}
          </p>
        )}
        {message.attachments && message.attachments.length > 0 && !message.content && (
          <p className="mt-0.5 text-sm text-th-text-muted italic">
            [attachment]
          </p>
        )}
      </div>
      {canUnpin && (
        <button
          onClick={handleUnpin}
          className="flex-shrink-0 self-center rounded p-1 text-th-text-muted opacity-0 group-hover:opacity-100 hover:text-th-red hover:bg-th-bg-accent transition-all"
          title="Unpin Message"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function PinnedMessages({ channelId, onClose, canUnpin }: PinnedMessagesProps) {
  const pinnedMessages = useMessageStore((s) => s.pinnedMessages.get(channelId) ?? []);
  const fetchPinnedMessages = useMessageStore((s) => s.fetchPinnedMessages);

  useEffect(() => {
    fetchPinnedMessages(channelId);
  }, [channelId, fetchPinnedMessages]);

  return (
    <div className="flex h-full w-[340px] flex-col border-l border-th-border bg-th-bg-secondary">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-th-border px-4">
        <h3 className="font-semibold text-white">Pinned Messages</h3>
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

      {/* Pinned messages list */}
      <div className="flex-1 overflow-y-auto p-2">
        {pinnedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="h-10 w-10 text-th-text-muted mb-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
            <p className="text-sm text-th-text-secondary">
              No pinned messages yet
            </p>
            <p className="mt-1 text-xs text-th-text-muted">
              Right-click a message to pin it
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {pinnedMessages.map((message) => (
              <PinnedMessageItem
                key={message.id}
                message={message}
                canUnpin={canUnpin}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DMMessage, DMChannelWithUser, ClientEvent } from '@harmonium/shared';
import { useDMStore } from '../../stores/dm.store.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { sendDMMessage, deleteDMMessage } from '../../api/dm.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { formatDate } from '../../lib/formatters.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';
import { ContextMenu, type ContextMenuState } from '../shared/ContextMenu.js';

const EMPTY_MESSAGES: DMMessage[] = [];
const TYPING_THROTTLE_MS = 5_000;
const TYPING_EXPIRE_MS = 10_000;

interface DMConversationProps {
  dmChannelId: string;
  channel: DMChannelWithUser;
  sendEvent: (event: ClientEvent) => void;
}

export function DMConversation({ dmChannelId, channel, sendEvent }: DMConversationProps) {
  const messages = useDMStore((s) => s.messages.get(dmChannelId) ?? EMPTY_MESSAGES);
  const hasMore = useDMStore((s) => s.hasMore.get(dmChannelId) ?? true);
  const fetchMessages = useDMStore((s) => s.fetchMessages);

  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const isAutoScrollRef = useRef(true);
  const lastTypingSentRef = useRef(0);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; username: string }>>([]);
  const typingMapRef = useRef<Map<string, { userId: string; username: string; timestamp: number }>>(new Map());
  const currentUserId = useAuthStore((s) => s.user?.id);

  // Fetch initial messages
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        await fetchMessages(dmChannelId);
      } catch (err) {
        console.error('Failed to fetch DM messages:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [dmChannelId, fetchMessages]);

  // Scroll handling
  const isNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  }, []);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && isAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [dmChannelId]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    isAutoScrollRef.current = isNearBottom();

    if (container.scrollTop < 100 && hasMore && !isLoading) {
      const prevHeight = container.scrollHeight;
      setIsLoading(true);
      const firstMessage = messages[0];
      if (firstMessage) {
        fetchMessages(dmChannelId, firstMessage.id)
          .then(() => {
            requestAnimationFrame(() => {
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
              }
            });
          })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }
  };

  // Listen for DM typing events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        dmChannelId: string;
        userId: string;
        username: string;
        timestamp: number;
      };
      if (detail.dmChannelId !== dmChannelId) return;
      if (detail.userId === currentUserId) return;

      typingMapRef.current.set(detail.userId, {
        userId: detail.userId,
        username: detail.username,
        timestamp: detail.timestamp,
      });
      setTypingUsers(Array.from(typingMapRef.current.values()));
    };

    window.addEventListener('ws:dm_typing_start', handler);
    return () => window.removeEventListener('ws:dm_typing_start', handler);
  }, [dmChannelId, currentUserId]);

  // Expire typing indicators
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

  // Clear typing on channel change
  useEffect(() => {
    typingMapRef.current.clear();
    setTypingUsers([]);
  }, [dmChannelId]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    sendEvent({ op: 'DM_TYPING_START', d: { dmChannelId } });
  }, [dmChannelId, sendEvent]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await sendDMMessage(dmChannelId, trimmed);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      console.error('Failed to send DM');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    sendTyping();
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // Group consecutive messages
  const isGrouped = (msg: DMMessage, prevMsg: DMMessage | undefined): boolean => {
    if (!prevMsg) return false;
    if (msg.authorId !== prevMsg.authorId) return false;
    const timeDiff = new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime();
    return timeDiff < 5 * 60 * 1000;
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-th-bg-primary">
      {/* Header */}
      <div className="flex h-12 items-center border-b border-th-border px-4 shadow-sm">
        <UserAvatar
          username={channel.user.username}
          avatarUrl={channel.user.avatarUrl}
          size={24}
          showStatus={false}
        />
        <span className="ml-2 font-semibold text-white">
          {channel.user.username}
        </span>
      </div>

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          {isLoading && (
            <div className="flex justify-center py-4">
              <LoadingSpinner size={24} className="text-th-brand" />
            </div>
          )}

          {!hasMore && messages.length > 0 && (
            <div className="px-4 pb-4 pt-8">
              <h3 className="text-2xl font-bold text-white">
                {channel.user.username}
              </h3>
              <p className="text-sm text-th-text-secondary">
                This is the beginning of your direct message history with {channel.user.username}.
              </p>
            </div>
          )}

          {messages.length === 0 && !isLoading && (
            <div className="flex h-full items-center justify-center">
              <p className="text-th-text-secondary">
                No messages yet. Say hello!
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <DMMessageItem
              key={msg.id}
              message={msg}
              dmChannelId={dmChannelId}
              isGrouped={isGrouped(msg, messages[i - 1])}
            />
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="absolute bottom-0 left-4 right-4 flex items-center gap-1.5 pb-0.5 text-xs text-th-text-primary">
            <span className="flex gap-0.5">
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-white [animation-delay:0ms]" />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-white [animation-delay:150ms]" />
              <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-white [animation-delay:300ms]" />
            </span>
            <span>
              <strong>{typingUsers[0].username}</strong> is typing
            </span>
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="px-4 pb-6 pt-2">
        <div className="flex items-end rounded-lg bg-th-bg-accent">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message @${channel.user.username}`}
            rows={1}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-4 py-2.5 text-sm text-th-text-primary placeholder-th-text-muted outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// ===== DM Message Item =====

function DMMessageItem({
  message,
  dmChannelId,
  isGrouped,
}: {
  message: DMMessage;
  dmChannelId: string;
  isGrouped: boolean;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOwnMessage = message.authorId === currentUserId;

  const handleDelete = async () => {
    try {
      await deleteDMMessage(dmChannelId, message.id);
    } catch {
      console.error('Failed to delete DM message');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const items: ContextMenuState['items'] = [];

    items.push({
      label: 'Copy Text',
      onClick: () => {
        navigator.clipboard.writeText(message.content ?? '');
      },
    });

    if (isOwnMessage) {
      items.push({ separator: true });
      items.push({
        label: 'Delete',
        onClick: handleDelete,
        danger: true,
      });
    }

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  if (message.isDeleted) return null;

  if (isGrouped) {
    return (
      <div
        className="group relative flex items-start px-4 py-0.5 hover:bg-th-bg-message-hover"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onContextMenu={handleContextMenu}
      >
        <span className="w-[72px] flex-shrink-0 pt-0.5 text-right opacity-0 group-hover:opacity-100">
          <span className="text-[10px] text-th-text-muted">
            {new Date(message.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          {message.content && (
            <p className="text-sm text-th-text-primary break-words">
              {message.content}
            </p>
          )}
        </div>
        {isHovering && isOwnMessage && (
          <div className="absolute -top-3 right-4 flex rounded bg-th-bg-secondary shadow-md border border-th-border">
            <button
              onClick={handleDelete}
              className="rounded p-1.5 text-th-text-secondary hover:text-th-red hover:bg-th-bg-primary transition-colors"
              title="Delete"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15ZM5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5Z" />
              </svg>
            </button>
          </div>
        )}
        {contextMenu && (
          <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />
        )}
      </div>
    );
  }

  return (
    <div
      className="group relative mt-4 flex items-start px-4 py-0.5 hover:bg-th-bg-message-hover"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onContextMenu={handleContextMenu}
    >
      <div className="mr-4 mt-0.5 flex-shrink-0">
        <UserAvatar
          username={message.author?.username ?? 'Unknown'}
          avatarUrl={message.author?.avatarUrl}
          size={40}
          showStatus={false}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-white">
            {message.author?.username ?? 'Unknown'}
          </span>
          <span className="text-xs text-th-text-muted">
            {formatDate(message.createdAt)}
          </span>
        </div>
        {message.content && (
          <p className="text-sm text-th-text-primary break-words">
            {message.content}
          </p>
        )}
      </div>
      {isHovering && isOwnMessage && (
        <div className="absolute -top-3 right-4 flex rounded bg-th-bg-secondary shadow-md border border-th-border">
          <button
            onClick={handleDelete}
            className="rounded p-1.5 text-th-text-secondary hover:text-th-red hover:bg-th-bg-primary transition-colors"
            title="Delete"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15ZM5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5Z" />
            </svg>
          </button>
        </div>
      )}
      {contextMenu && (
        <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}

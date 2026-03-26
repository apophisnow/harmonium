import React, { useState, type ReactNode } from 'react';
import type { Attachment, Reaction, ServerMember, ThreadListItem } from '@harmonium/shared';
import type { ClientMessage } from '../../types.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { useMessageStore } from '../../stores/message.store.js';
import { useMemberStore } from '../../stores/member.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { useThreadStore } from '../../stores/thread.store.js';

const EMPTY_MEMBERS: ServerMember[] = [];
const EMPTY_THREADS: ThreadListItem[] = [];
import { editMessage, deleteMessage, pinMessage, unpinMessage, sendMessage } from '../../api/messages.js';
import { addReaction, removeReaction } from '../../api/reactions.js';
import { createThread, getThread } from '../../api/threads.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { UserProfilePopover } from '../user/UserProfilePopover.js';
import { formatDate } from '../../lib/formatters.js';
import { ContextMenu, type ContextMenuState } from '../shared/ContextMenu.js';
import { useEmojiStore } from '../../stores/emoji.store.js';
import { useRelationshipStore } from '../../stores/relationship.store.js';
import { EmojiPicker } from './EmojiPicker.js';
import { MessageEmbed } from './MessageEmbed.js';
import { renderMarkdown } from '../../utils/markdown.js';
import { AttachmentPreview } from './AttachmentPreview.js';

interface MessageItemProps {
  message: ClientMessage;
  isGrouped: boolean;
}

function getReplyPreviewText(replyTo: Message): string {
  if (replyTo.isDeleted) return '';
  if (replyTo.content) {
    return replyTo.content.length > 80 ? replyTo.content.slice(0, 80) + '...' : replyTo.content;
  }
  if (replyTo.attachments && replyTo.attachments.length > 0) {
    return '[attachment]';
  }
  return '';
}

function ReplyPreview({ replyTo }: { replyTo: Message }) {
  const handleClick = () => {
    const el = document.querySelector(`[data-message-id="${replyTo.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-th-bg-message-hover');
      setTimeout(() => el.classList.remove('bg-th-bg-message-hover'), 1500);
    }
  };

  return (
    <div
      className="mb-1 flex items-center gap-1.5 cursor-pointer text-sm text-th-text-muted hover:text-th-text-secondary"
      onClick={handleClick}
    >
      <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 17l-5-5 5-5M4 12h16" />
      </svg>
      {replyTo.isDeleted ? (
        <span className="italic">Original message was deleted</span>
      ) : (
        <>
          <UserAvatar
            username={replyTo.author?.username ?? 'Unknown'}
            avatarUrl={replyTo.author?.avatarUrl}
            size={16}
            showStatus={false}
          />
          <span className="font-medium text-th-text-secondary text-xs">
            {replyTo.author?.username ?? 'Unknown'}
          </span>
          <span className="truncate text-xs">{getReplyPreviewText(replyTo)}</span>
        </>
      )}
    </div>
  );
}

function MessageReactions({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: Reaction[];
  currentUserId: string | undefined;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => {
        const hasReacted = currentUserId ? r.userIds.includes(currentUserId) : false;
        return (
          <button
            key={r.emoji}
            onClick={() => onToggle(r.emoji)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border cursor-pointer transition-colors ${
              hasReacted
                ? 'bg-th-brand/20 border-th-brand'
                : 'border-th-border hover:bg-th-bg-accent'
            }`}
          >
            <span>{r.emoji}</span>
            <span className="text-xs text-th-text-secondary">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThreadIndicator({
  thread,
  onClick,
}: {
  thread: ThreadListItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="mt-1 flex items-center gap-1.5 text-sm text-th-brand hover:underline cursor-pointer"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H18L22 24V6ZM20 6V17.17L18.83 16H4V6H20ZM6 12H18V14H6V12ZM6 9H18V11H6V9Z" />
      </svg>
      <span className="font-medium">
        {thread.messageCount} {thread.messageCount === 1 ? 'reply' : 'replies'}
      </span>
    </button>
  );
}

function MessageContent({ content }: { content: string }) {
  const currentServerId = useServerStore((s) => s.currentServerId);
  const members = useMemberStore((s) => currentServerId ? (s.members.get(currentServerId) ?? EMPTY_MEMBERS) : EMPTY_MEMBERS);

  // Resolve mention placeholders before markdown parsing
  const resolved = content.replace(/<@(\d+)>/g, (_match, userId: string) => {
    const member = members.find((m) => m.userId === userId);
    const username = member?.user?.username ?? 'Unknown User';
    return `@${username}`;
  });

  return <>{renderMarkdown(resolved)}</>;
}

export const MessageItem = React.memo(function MessageItem({ message, isGrouped }: MessageItemProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? '');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [profilePopover, setProfilePopover] = useState<{ position: { x: number; y: number } } | null>(null);
  const [showIgnoredMessage, setShowIgnoredMessage] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isBlockedUser = useRelationshipStore((s) => s.isBlocked(message.authorId));
  const isIgnoredUser = useRelationshipStore((s) => s.isIgnored(message.authorId));
  const currentServerId = useServerStore((s) => s.currentServerId);
  const members = useMemberStore((s) => currentServerId ? (s.members.get(currentServerId) ?? EMPTY_MEMBERS) : EMPTY_MEMBERS);
  const setReplyingTo = useMessageStore((s) => s.setReplyingTo);
  const retryMessage = useMessageStore((s) => s.retryMessage);
  const failMessageStore = useMessageStore((s) => s.failMessage);
  const removeOptimisticMessage = useMessageStore((s) => s.removeMessage);
  const threads = useThreadStore((s) => s.threads.get(message.channelId) ?? EMPTY_THREADS);
  const setActiveThread = useThreadStore((s) => s.setActiveThread);

  const isPending = message._isPending === true;
  const isFailed = message._isFailed === true;
  const isWebhookMessage = !!message.webhookId;
  const isOwnMessage = message.authorId === currentUserId && !isWebhookMessage;

  // Hide messages from blocked users
  if (isBlockedUser && !isOwnMessage) {
    return (
      <div className="px-4 py-1 text-sm text-th-text-muted italic">
        Message from a blocked user
      </div>
    );
  }

  // Collapse messages from ignored users with click-to-reveal
  if (isIgnoredUser && !isOwnMessage && !showIgnoredMessage) {
    return (
      <div
        className="px-4 py-1 text-sm text-th-text-muted italic cursor-pointer hover:text-th-text-secondary transition-colors"
        onClick={() => setShowIgnoredMessage(true)}
      >
        Message from an ignored user — click to reveal
      </div>
    );
  }

  const handleAuthorClick = (e: React.MouseEvent) => {
    if (isWebhookMessage || !message.author) return;
    e.stopPropagation();
    setProfilePopover({ position: { x: e.clientX, y: e.clientY } });
  };

  const authorMember = message.author
    ? members.find((m) => m.userId === message.authorId)
    : undefined;

  // Check if this message has a thread
  const messageThread = threads.find((t) => t.originMessageId === message.id);

  const handleRetry = async () => {
    if (!message._tempId) return;
    const retried = retryMessage(message.channelId, message._tempId);
    if (!retried) return;
    try {
      await sendMessage(
        retried.channelId,
        retried.content ?? '',
        undefined,
        retried.replyToId ?? undefined,
      );
    } catch {
      if (retried._tempId) {
        failMessageStore(retried._tempId);
      }
    }
  };

  const handleDismissFailedMessage = () => {
    if (message._tempId) {
      removeOptimisticMessage(message.channelId, message._tempId);
    }
  };

  const handleReply = () => {
    setReplyingTo(message);
  };

  const handleCreateThread = async () => {
    try {
      const contentPreview = message.content
        ? message.content.slice(0, 30).replace(/\s+/g, '-')
        : 'thread';
      const thread = await createThread(message.channelId, {
        name: contentPreview,
        messageId: message.id,
      });
      setActiveThread(thread);
    } catch {
      console.error('Failed to create thread');
    }
  };

  const handleOpenThread = async () => {
    if (!messageThread) return;
    try {
      const thread = await getThread(messageThread.id);
      setActiveThread(thread);
    } catch {
      console.error('Failed to open thread');
    }
  };

  const handleEditSubmit = async () => {
    if (!editContent.trim()) return;
    try {
      await editMessage(message.channelId, message.id, editContent.trim());
      setIsEditing(false);
    } catch {
      console.error('Failed to edit message');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content ?? '');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMessage(message.channelId, message.id);
    } catch {
      console.error('Failed to delete message');
    }
  };

  const handleTogglePin = async () => {
    try {
      if (message.isPinned) {
        await unpinMessage(message.channelId, message.id);
      } else {
        await pinMessage(message.channelId, message.id);
      }
    } catch {
      console.error('Failed to toggle pin');
    }
  };

  const handleReactionToggle = async (emoji: string) => {
    if (!currentUserId) return;
    const existing = message.reactions?.find((r) => r.emoji === emoji);
    try {
      if (existing?.userIds.includes(currentUserId)) {
        await removeReaction(message.channelId, message.id, emoji);
      } else {
        await addReaction(message.channelId, message.id, emoji);
      }
    } catch {
      console.error('Failed to toggle reaction');
    }
  };

  const handleAddReactionFromPicker = async (emoji: string) => {
    if (!currentUserId) return;
    try {
      await addReaction(message.channelId, message.id, emoji);
      useEmojiStore.getState().recordEmoji(emoji);
    } catch {
      console.error('Failed to add reaction');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    const { frequentEmoji } = useEmojiStore.getState();

    const quickReactHeader = (
      <div className="flex items-center justify-around px-1 py-0.5">
        {frequentEmoji.map((emoji) => (
          <button
            key={emoji}
            className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-th-bg-primary transition-colors"
            onClick={() => {
              addReaction(message.channelId, message.id, emoji).catch(() =>
                console.error('Failed to add reaction'),
              );
              useEmojiStore.getState().recordEmoji(emoji);
              setContextMenu(null);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    );

    const items: ContextMenuState['items'] = [];

    items.push({
      label: 'Add Reaction',
      onClick: () => setShowEmojiPicker(true),
    });

    items.push({ separator: true });

    items.push({
      label: 'Reply',
      onClick: handleReply,
    });

    if (messageThread) {
      items.push({
        label: 'Open Thread',
        onClick: handleOpenThread,
      });
    } else {
      items.push({
        label: 'Create Thread',
        onClick: handleCreateThread,
      });
    }

    items.push({ separator: true });

    if (isOwnMessage) {
      items.push({
        label: 'Edit',
        onClick: () => {
          setEditContent(message.content ?? '');
          setIsEditing(true);
        },
      });
    }

    if (!message.isDeleted) {
      items.push({
        label: message.isPinned ? 'Unpin Message' : 'Pin Message',
        onClick: handleTogglePin,
      });
    }

    items.push({
      label: 'Copy Text',
      onClick: () => {
        navigator.clipboard.writeText(message.content ?? '');
      },
    });

    items.push({
      label: 'Copy Message Link',
      onClick: () => {
        const url = `${window.location.origin}${window.location.pathname}?message=${message.id}`;
        navigator.clipboard.writeText(url);
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

    setContextMenu({ x: e.clientX, y: e.clientY, items, header: quickReactHeader });
  };

  const hasReply = message.replyTo !== undefined && message.replyTo !== null;

  if (isGrouped) {
    return (
      <div
        className={`group relative flex items-start px-4 py-0.5 hover:bg-th-bg-message-hover ${isPending ? 'opacity-50' : ''} ${isFailed ? 'opacity-70' : ''}`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onContextMenu={!isPending && !isFailed ? handleContextMenu : undefined}
        data-message-id={message.id}
      >
        {/* Timestamp on hover in grouped mode */}
        <span className="w-[72px] flex-shrink-0 pt-0.5 text-right opacity-0 group-hover:opacity-100">
          <span className="text-[10px] text-th-text-muted">
            {new Date(message.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </span>
        </span>
        {message.isPinned && (
          <svg className="absolute left-1 top-1/2 -translate-y-1/2 h-3 w-3 text-th-text-muted" viewBox="0 0 24 24" fill="currentColor" aria-label="Pinned">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        )}

        <div className="min-w-0 flex-1">
          {hasReply && <ReplyPreview replyTo={message.replyTo!} />}
          {isEditing ? (
            <div className="rounded bg-th-bg-accent p-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full resize-none bg-transparent text-sm text-th-text-primary outline-none"
                autoFocus
                rows={1}
              />
              <p className="mt-1 text-xs text-th-text-secondary">
                Press Enter to save, Escape to cancel
              </p>
            </div>
          ) : (
            <>
              {message.content && (
                <div className="text-sm text-th-text-primary break-words">
                  <MessageContent content={message.content} />
                  {message.editedAt && (
                    <span className="ml-1 text-[10px] text-th-text-muted">
                      (edited)
                    </span>
                  )}
                </div>
              )}
              <AttachmentPreview attachments={message.attachments ?? []} />
              {message.embeds?.map((embed) => (
                <MessageEmbed key={embed.id} embed={embed} />
              ))}
            </>
          )}
          <MessageReactions
            reactions={message.reactions ?? []}
            currentUserId={currentUserId}
            onToggle={handleReactionToggle}
          />
          {messageThread && (
            <ThreadIndicator thread={messageThread} onClick={handleOpenThread} />
          )}
          {isFailed && (
            <FailedMessageBar onRetry={handleRetry} onDismiss={handleDismissFailedMessage} />
          )}
        </div>

        {/* Action buttons */}
        {isHovering && !isEditing && !isPending && !isFailed && (
          <MessageActions
            onReply={handleReply}
            onAddReaction={() => setShowEmojiPicker(true)}
            onMore={handleContextMenu}
          />
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="absolute -top-3 right-4 z-50">
            <EmojiPicker
              onSelect={handleAddReactionFromPicker}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            {...contextMenu}
            onClose={() => setContextMenu(null)}
          />
        )}

        {/* User profile popover */}
        {profilePopover && message.author && (
          <UserProfilePopover
            user={message.author}
            member={authorMember}
            serverId={currentServerId ?? undefined}
            position={profilePopover.position}
            onClose={() => setProfilePopover(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`group relative mt-4 flex items-start px-4 py-0.5 hover:bg-th-bg-message-hover ${isPending ? 'opacity-50' : ''} ${isFailed ? 'opacity-70' : ''}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onContextMenu={!isPending && !isFailed ? handleContextMenu : undefined}
      data-message-id={message.id}
    >
      <div
        className={`mr-4 mt-0.5 flex-shrink-0 ${!isWebhookMessage && message.author ? 'cursor-pointer' : ''}`}
        onClick={handleAuthorClick}
      >
        <UserAvatar
          username={isWebhookMessage ? (message.webhookName ?? 'Webhook') : (message.author?.username ?? 'Unknown')}
          avatarUrl={isWebhookMessage ? (message.webhookAvatarUrl ?? undefined) : message.author?.avatarUrl}
          size={40}
          showStatus={false}
        />
      </div>

      <div className="min-w-0 flex-1">
        {hasReply && <ReplyPreview replyTo={message.replyTo!} />}
        <div className="flex items-baseline gap-2">
          <span
            className="font-medium text-white hover:underline cursor-pointer"
            onClick={handleAuthorClick}
          >
            {isWebhookMessage ? (message.webhookName ?? 'Webhook') : (message.author?.username ?? 'Unknown')}
          </span>
          {isWebhookMessage && (
            <span className="relative -top-px rounded bg-th-brand/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-th-brand">
              BOT
            </span>
          )}
          <span className="text-xs text-th-text-muted">
            {formatDate(message.createdAt)}
          </span>
          {message.isPinned && (
            <svg className="h-3 w-3 text-th-text-muted flex-shrink-0 translate-y-[1px]" viewBox="0 0 24 24" fill="currentColor" aria-label="Pinned">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          )}
        </div>

        {isEditing ? (
          <div className="mt-1 rounded bg-th-bg-accent p-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="w-full resize-none bg-transparent text-sm text-th-text-primary outline-none"
              autoFocus
              rows={1}
            />
            <p className="mt-1 text-xs text-th-text-secondary">
              Press Enter to save, Escape to cancel
            </p>
          </div>
        ) : (
          <>
            {message.content && (
              <div className="text-sm text-th-text-primary break-words">
                <MessageContent content={message.content} />
                {message.editedAt && (
                  <span className="ml-1 text-[10px] text-th-text-muted">
                    (edited)
                  </span>
                )}
              </div>
            )}
            <AttachmentPreview attachments={message.attachments ?? []} />
            {message.embeds?.map((embed) => (
              <MessageEmbed key={embed.id} embed={embed} />
            ))}
          </>
        )}
        <MessageReactions
          reactions={message.reactions ?? []}
          currentUserId={currentUserId}
          onToggle={handleReactionToggle}
        />
        {messageThread && (
          <ThreadIndicator thread={messageThread} onClick={handleOpenThread} />
        )}
        {isFailed && (
          <FailedMessageBar onRetry={handleRetry} onDismiss={handleDismissFailedMessage} />
        )}
      </div>

      {/* Action buttons */}
      {isHovering && !isEditing && !isPending && !isFailed && (
        <MessageActions
          onReply={handleReply}
          onAddReaction={() => setShowEmojiPicker(true)}
          onMore={handleContextMenu}
        />
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="absolute -top-3 right-4 z-50">
          <EmojiPicker
            onSelect={handleAddReactionFromPicker}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* User profile popover */}
      {profilePopover && message.author && (
        <UserProfilePopover
          user={message.author}
          member={authorMember}
          serverId={currentServerId ?? undefined}
          position={profilePopover.position}
          onClose={() => setProfilePopover(null)}
        />
      )}
    </div>
  );
}

function MessageActions({
  onReply,
  onAddReaction,
  onMore,
}: {
  onReply: () => void;
  onAddReaction: () => void;
  onMore: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="absolute -top-3 right-4 flex rounded bg-th-bg-secondary shadow-md border border-th-border">
      <button
        onClick={onAddReaction}
        className="rounded-l p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-primary transition-colors"
        title="Add Reaction"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm3.5-9c.828 0 1.5-.672 1.5-1.5S16.328 8 15.5 8 14 8.672 14 9.5s.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5S9.328 8 8.5 8 7 8.672 7 9.5 7.672 11 8.5 11zm3.5 6.5c2.33 0 4.32-1.45 5.12-3.5H6.88c.8 2.05 2.79 3.5 5.12 3.5z" />
        </svg>
      </button>
      <button
        onClick={onReply}
        className="p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-primary transition-colors"
        title="Reply"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
        </svg>
      </button>
      <button
        onClick={onMore}
        className="rounded-r p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-primary transition-colors"
        title="More"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>
    </div>
  );
}

function FailedMessageBar({
  onRetry,
  onDismiss,
}: {
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-2 text-xs">
      <span className="text-red-400">Failed to send</span>
      <button
        onClick={onRetry}
        className="text-red-400 hover:text-red-300 underline transition-colors"
      >
        Retry
      </button>
      <span className="text-th-text-muted">|</span>
      <button
        onClick={onDismiss}
        className="text-th-text-muted hover:text-th-text-secondary underline transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
});


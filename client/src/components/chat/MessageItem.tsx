import { useState } from 'react';
import type { Message, Attachment, Reaction } from '@harmonium/shared';
import { useAuthStore } from '../../stores/auth.store.js';
import { useMessageStore } from '../../stores/message.store.js';
import { editMessage, deleteMessage } from '../../api/messages.js';
import { addReaction, removeReaction } from '../../api/reactions.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { formatDate } from '../../lib/formatters.js';
import { ContextMenu, type ContextMenuState } from '../shared/ContextMenu.js';
import { EmojiPicker } from './EmojiPicker.js';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentDisplay({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.contentType?.startsWith('image/') ?? false;

  if (isImage) {
    return (
      <div className="mt-1 max-w-[400px]">
        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
          <img
            src={attachment.url}
            alt={attachment.filename}
            className="max-h-[300px] max-w-full rounded object-contain cursor-pointer"
            loading="lazy"
          />
        </a>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-3 rounded bg-th-bg-secondary border border-th-border px-3 py-2 max-w-[400px]">
      <svg className="h-8 w-8 flex-shrink-0 text-th-text-secondary" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
      </svg>
      <div className="min-w-0 flex-1">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm text-th-text-link hover:underline"
        >
          {attachment.filename}
        </a>
        <span className="text-xs text-th-text-muted">{formatFileSize(attachment.sizeBytes)}</span>
      </div>
      <a
        href={attachment.url}
        download={attachment.filename}
        className="flex-shrink-0 p-1 text-th-text-secondary hover:text-th-text-primary transition-colors"
        title="Download"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
      </a>
    </div>
  );
}

function MessageAttachments({ attachments }: { attachments?: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {attachments.map((att) => (
        <AttachmentDisplay key={att.id} attachment={att} />
      ))}
    </div>
  );
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

export function MessageItem({ message, isGrouped }: MessageItemProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? '');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const setReplyingTo = useMessageStore((s) => s.setReplyingTo);

  const isOwnMessage = message.authorId === currentUserId;

  const handleReply = () => {
    setReplyingTo(message);
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
    } catch {
      console.error('Failed to add reaction');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    const items: ContextMenuState['items'] = [];

    items.push({
      label: 'Reply',
      onClick: handleReply,
    });

    if (isOwnMessage) {
      items.push({
        label: 'Edit',
        onClick: () => {
          setEditContent(message.content ?? '');
          setIsEditing(true);
        },
      });
    }

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

  const hasReply = message.replyTo !== undefined && message.replyTo !== null;

  if (isGrouped) {
    return (
      <div
        className="group relative flex items-start px-4 py-0.5 hover:bg-th-bg-message-hover"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onContextMenu={handleContextMenu}
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
                <p className="text-sm text-th-text-primary break-words">
                  {message.content}
                  {message.editedAt && (
                    <span className="ml-1 text-[10px] text-th-text-muted">
                      (edited)
                    </span>
                  )}
                </p>
              )}
              <MessageAttachments attachments={message.attachments} />
            </>
          )}
          <MessageReactions
            reactions={message.reactions ?? []}
            currentUserId={currentUserId}
            onToggle={handleReactionToggle}
          />
        </div>

        {/* Action buttons */}
        {isHovering && !isEditing && (
          <MessageActions
            isOwnMessage={isOwnMessage}
            onReply={handleReply}
            onEdit={() => {
              setEditContent(message.content ?? '');
              setIsEditing(true);
            }}
            onDelete={handleDelete}
            onAddReaction={() => setShowEmojiPicker(true)}
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
      </div>
    );
  }

  return (
    <div
      className="group relative mt-4 flex items-start px-4 py-0.5 hover:bg-th-bg-message-hover"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onContextMenu={handleContextMenu}
      data-message-id={message.id}
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
        {hasReply && <ReplyPreview replyTo={message.replyTo!} />}
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-white hover:underline cursor-pointer">
            {message.author?.username ?? 'Unknown'}
          </span>
          <span className="text-xs text-th-text-muted">
            {formatDate(message.createdAt)}
          </span>
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
              <p className="text-sm text-th-text-primary break-words">
                {message.content}
                {message.editedAt && (
                  <span className="ml-1 text-[10px] text-th-text-muted">
                    (edited)
                  </span>
                )}
              </p>
            )}
            <MessageAttachments attachments={message.attachments} />
          </>
        )}
        <MessageReactions
          reactions={message.reactions ?? []}
          currentUserId={currentUserId}
          onToggle={handleReactionToggle}
        />
      </div>

      {/* Action buttons */}
      {isHovering && !isEditing && (
        <MessageActions
          isOwnMessage={isOwnMessage}
          onReply={handleReply}
          onEdit={() => {
            setEditContent(message.content ?? '');
            setIsEditing(true);
          }}
          onDelete={handleDelete}
          onAddReaction={() => setShowEmojiPicker(true)}
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
    </div>
  );
}

function MessageActions({
  isOwnMessage,
  onReply,
  onEdit,
  onDelete,
  onAddReaction,
}: {
  isOwnMessage: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddReaction: () => void;
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
        className={`${isOwnMessage ? '' : 'rounded-r'} p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-primary transition-colors`}
        title="Reply"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
        </svg>
      </button>
      {isOwnMessage && (
        <>
          <button
            onClick={onEdit}
            className="p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-primary transition-colors"
            title="Edit"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.293 2.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-13 13A1 1 0 0 1 8 21H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 .293-.707l13-13zM5 16.414V19h2.586l12-12L17 4.414l-12 12z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded-r p-1.5 text-th-text-secondary hover:text-th-red hover:bg-th-bg-primary transition-colors"
            title="Delete"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15ZM5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5Z" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

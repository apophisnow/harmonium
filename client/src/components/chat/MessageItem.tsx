import { useState } from 'react';
import type { Message, Attachment } from '@harmonium/shared';
import { useAuthStore } from '../../stores/auth.store.js';
import { editMessage, deleteMessage } from '../../api/messages.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { formatDate } from '../../lib/formatters.js';
import { ContextMenu, type ContextMenuState } from '../shared/ContextMenu.js';

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

export function MessageItem({ message, isGrouped }: MessageItemProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? '');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const isOwnMessage = message.authorId === currentUserId;

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    const items: ContextMenuState['items'] = [];

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

  if (isGrouped) {
    return (
      <div
        className="group relative flex items-start px-4 py-0.5 hover:bg-th-bg-message-hover"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onContextMenu={handleContextMenu}
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
        </div>

        {/* Action buttons */}
        {isHovering && isOwnMessage && !isEditing && (
          <MessageActions
            onEdit={() => {
              setEditContent(message.content ?? '');
              setIsEditing(true);
            }}
            onDelete={handleDelete}
          />
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
      </div>

      {/* Action buttons */}
      {isHovering && isOwnMessage && !isEditing && (
        <MessageActions
          onEdit={() => {
            setEditContent(message.content ?? '');
            setIsEditing(true);
          }}
          onDelete={handleDelete}
        />
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
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute -top-3 right-4 flex rounded bg-th-bg-secondary shadow-md border border-th-border">
      <button
        onClick={onEdit}
        className="rounded-l p-1.5 text-th-text-secondary hover:text-th-text-primary hover:bg-th-bg-primary transition-colors"
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
    </div>
  );
}

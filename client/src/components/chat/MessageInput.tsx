import { useState, useRef, useCallback, useEffect } from 'react';
import type { ServerMember } from '@harmonium/shared';
import { sendMessage } from '../../api/messages.js';
import { useMessageStore } from '../../stores/message.store.js';
import { useMemberStore } from '../../stores/member.store.js';

const EMPTY_MEMBERS: ServerMember[] = [];

interface MessageInputProps {
  channelId: string;
  channelName: string;
  serverId: string;
  onTyping?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInput({
  channelId,
  channelName,
  serverId,
  onTyping,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyingTo = useMessageStore((s) => s.replyingTo);
  const setReplyingTo = useMessageStore((s) => s.setReplyingTo);
  const members = useMemberStore((s) => s.members.get(serverId) ?? EMPTY_MEMBERS);

  // Filter members by mention query
  const filteredMembers = mentionQuery !== null
    ? members
        .filter((m) =>
          m.user?.username.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
        .slice(0, 8)
    : [];

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if ((!trimmed && files.length === 0) || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(
        channelId,
        trimmed,
        files.length > 0 ? files : undefined,
        replyingTo?.id,
      );
      setContent('');
      setFiles([]);
      setReplyingTo(null);
      setMentionQuery(null);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      console.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const insertMention = useCallback(
    (userId: string, username: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBefore = content.slice(0, cursorPos);
      const textAfter = content.slice(cursorPos);

      // Find the @ that started the mention
      const atIndex = textBefore.lastIndexOf('@');
      if (atIndex === -1) return;

      const newText =
        textBefore.slice(0, atIndex) + `<@${userId}> ` + textAfter;
      setContent(newText);
      setMentionQuery(null);

      // Restore focus and cursor position
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newPos = atIndex + `<@${userId}> `.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [content],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention autocomplete navigation
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev === 0 ? filteredMembers.length - 1 : prev - 1,
        );
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const member = filteredMembers[mentionIndex];
        if (member?.user) {
          insertMention(member.userId, member.user.username);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && replyingTo) {
      setReplyingTo(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    onTyping?.();

    // Check for mention trigger
    const cursorPos = e.target.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    // Reset the input so selecting the same file again triggers onChange
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const hasTopSection = replyingTo || files.length > 0;

  return (
    <div className="px-4 pb-6 pt-2">
      {/* Reply bar */}
      {replyingTo && (
        <div className={`flex items-center justify-between bg-th-bg-accent px-3 py-2 ${files.length > 0 ? '' : 'rounded-t-lg'}`}>
          <span className="text-sm text-th-text-secondary">
            Replying to <span className="font-medium text-th-text-primary">{replyingTo.author?.username ?? 'Unknown'}</span>
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-th-text-secondary hover:text-th-text-primary transition-colors"
            title="Cancel reply"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
            </svg>
          </button>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className={`flex flex-wrap gap-2 bg-th-bg-accent px-3 pt-3 pb-1 ${replyingTo ? '' : 'rounded-t-lg'}`}>
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded bg-th-bg-secondary px-3 py-2 text-sm text-th-text-primary"
            >
              {file.type.startsWith('image/') ? (
                <svg className="h-4 w-4 flex-shrink-0 text-th-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM4 19l4-5 2.77 3.46L14 13l6 6H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 flex-shrink-0 text-th-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                </svg>
              )}
              <span className="max-w-[150px] truncate">{file.name}</span>
              <span className="text-xs text-th-text-muted">{formatFileSize(file.size)}</span>
              <button
                onClick={() => removeFile(index)}
                className="ml-1 text-th-text-secondary hover:text-th-red transition-colors"
                title="Remove attachment"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`relative flex items-end bg-th-bg-accent ${hasTopSection ? 'rounded-b-lg' : 'rounded-lg'}`}>
        {/* Mention autocomplete dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 max-h-[200px] overflow-y-auto rounded-lg bg-th-bg-secondary border border-th-border shadow-lg z-10">
            {filteredMembers.map((member, i) => (
              <button
                key={member.userId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (member.user) {
                    insertMention(member.userId, member.user.username);
                  }
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-th-text-primary hover:bg-th-bg-accent ${
                  i === mentionIndex ? 'bg-th-bg-accent' : ''
                }`}
              >
                <span className="font-medium">@{member.user?.username ?? 'Unknown'}</span>
              </button>
            ))}
          </div>
        )}

        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 p-2.5 text-th-text-secondary hover:text-th-text-primary transition-colors"
          title="Attach a file"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-th-text-primary placeholder-th-text-muted outline-none"
        />
      </div>
    </div>
  );
}

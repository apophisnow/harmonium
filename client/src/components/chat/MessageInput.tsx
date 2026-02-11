import { useState, useRef } from 'react';
import { sendMessage } from '../../api/messages.js';

interface MessageInputProps {
  channelId: string;
  channelName: string;
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
  onTyping,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if ((!trimmed && files.length === 0) || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(channelId, trimmed, files.length > 0 ? files : undefined);
      setContent('');
      setFiles([]);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping?.();

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

  return (
    <div className="px-4 pb-6 pt-2">
      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-t-lg bg-[#40444b] px-3 pt-3 pb-1">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded bg-[#2f3136] px-3 py-2 text-sm text-[#dcddde]"
            >
              {file.type.startsWith('image/') ? (
                <svg className="h-4 w-4 flex-shrink-0 text-[#96989d]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM4 19l4-5 2.77 3.46L14 13l6 6H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 flex-shrink-0 text-[#96989d]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                </svg>
              )}
              <span className="max-w-[150px] truncate">{file.name}</span>
              <span className="text-xs text-[#72767d]">{formatFileSize(file.size)}</span>
              <button
                onClick={() => removeFile(index)}
                className="ml-1 text-[#96989d] hover:text-[#ed4245] transition-colors"
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

      <div className={`flex items-end bg-[#40444b] ${files.length > 0 ? 'rounded-b-lg' : 'rounded-lg'}`}>
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 p-2.5 text-[#96989d] hover:text-[#dcddde] transition-colors"
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
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-[#dcddde] placeholder-[#72767d] outline-none"
        />
      </div>
    </div>
  );
}

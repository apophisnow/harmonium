import { useState, useEffect, useCallback, useRef } from 'react';
import type { CustomEmoji } from '@harmonium/shared';
import { getServerEmojis, uploadEmoji, deleteEmoji, renameEmoji } from '../../../api/emojis.js';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface EmojiTabProps {
  serverId: string | null;
  canManageServer: boolean;
}

const MAX_EMOJI_SIZE = 256 * 1024; // 256KB
const ALLOWED_TYPES = ['image/png', 'image/gif', 'image/webp'];

export function EmojiTab({ serverId, canManageServer }: EmojiTabProps) {
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [emojiName, setEmojiName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmojis = useCallback(async () => {
    if (!serverId) return;
    setIsLoading(true);
    setError('');
    try {
      const fetched = await getServerEmojis(serverId);
      setEmojis(fetched);
    } catch {
      setError('Failed to load emojis.');
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchEmojis();
  }, [fetchEmojis]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Emoji must be a PNG, GIF, or WebP image.');
      return;
    }

    if (file.size > MAX_EMOJI_SIZE) {
      setError('File too large. Maximum emoji size is 256KB.');
      return;
    }

    setError('');
    setSelectedFile(file);

    // Generate name from filename if empty
    if (!emojiName) {
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      setEmojiName(baseName.slice(0, 32) || 'emoji');
    }

    // Create preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!serverId || !selectedFile || !emojiName.trim()) return;

    setIsUploading(true);
    setError('');
    try {
      const emoji = await uploadEmoji(serverId, emojiName.trim(), selectedFile);
      setEmojis((prev) => [...prev, emoji]);
      setEmojiName('');
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch {
      setError('Failed to upload emoji.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (emojiId: string) => {
    if (!serverId) return;
    setDeletingId(emojiId);
    setError('');
    try {
      await deleteEmoji(serverId, emojiId);
      setEmojis((prev) => prev.filter((e) => e.id !== emojiId));
    } catch {
      setError('Failed to delete emoji.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartRename = (emoji: CustomEmoji) => {
    setEditingId(emoji.id);
    setEditName(emoji.name);
  };

  const handleSaveRename = async () => {
    if (!serverId || !editingId || !editName.trim()) return;
    setIsSaving(true);
    setError('');
    try {
      const updated = await renameEmoji(serverId, editingId, editName.trim());
      setEmojis((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditingId(null);
    } catch {
      setError('Failed to rename emoji.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditName('');
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    setEmojiName('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Emoji</h2>
        <span className="text-sm text-th-text-secondary">
          {emojis.length} / 50
        </span>
      </div>

      {error && <p className="text-sm text-th-red">{error}</p>}

      {/* Upload form */}
      {canManageServer && (
        <div className="rounded-lg bg-th-bg-secondary p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase text-th-text-secondary">
            Upload Emoji
          </h3>
          <div className="flex items-end gap-3">
            <div className="flex-shrink-0">
              <label
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-th-border transition-colors hover:border-th-brand"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-12 w-12 rounded object-contain"
                  />
                ) : (
                  <svg className="h-6 w-6 text-th-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-th-text-secondary">
                Name
              </label>
              <input
                type="text"
                value={emojiName}
                onChange={(e) => setEmojiName(e.target.value)}
                placeholder="emoji_name"
                maxLength={32}
                className="w-full rounded bg-th-bg-primary px-3 py-1.5 text-sm text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
              />
            </div>
            <div className="flex gap-2">
              {selectedFile && (
                <button
                  onClick={clearFileSelection}
                  className="rounded px-3 py-1.5 text-sm font-medium text-th-text-secondary transition-colors hover:text-th-text-primary"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={isUploading || !selectedFile || !emojiName.trim()}
                className="flex items-center gap-2 rounded bg-th-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading && <LoadingSpinner size={14} />}
                Upload
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-th-text-muted">
            PNG, GIF, or WebP. Max 256KB. Names must be alphanumeric/underscore, 2-32 characters.
          </p>
        </div>
      )}

      {/* Emoji grid */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} className="text-th-text-secondary" />
        </div>
      ) : emojis.length > 0 ? (
        <div className="space-y-1">
          {emojis.map((emoji) => (
            <div
              key={emoji.id}
              className="flex items-center gap-3 rounded-lg bg-th-bg-secondary px-4 py-2"
            >
              <img
                src={emoji.imageUrl}
                alt={`:${emoji.name}:`}
                className="h-8 w-8 object-contain"
                draggable={false}
              />
              {editingId === emoji.id ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={32}
                    className="min-w-0 flex-1 rounded bg-th-bg-primary px-2 py-1 text-sm text-th-text-primary outline-none focus:ring-2 focus:ring-th-brand"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') handleCancelRename();
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRename}
                    disabled={isSaving || !editName.trim()}
                    className="rounded px-2 py-1 text-xs font-medium text-th-brand transition-colors hover:text-th-brand-hover disabled:opacity-50"
                  >
                    {isSaving ? <LoadingSpinner size={12} /> : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelRename}
                    className="rounded px-2 py-1 text-xs font-medium text-th-text-secondary transition-colors hover:text-th-text-primary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-th-text-primary">
                      :{emoji.name}:
                    </p>
                  </div>
                  {canManageServer && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartRename(emoji)}
                        className="rounded p-1.5 text-th-text-secondary transition-colors hover:text-th-text-primary"
                        title="Rename emoji"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(emoji.id)}
                        disabled={deletingId === emoji.id}
                        className="rounded p-1.5 text-th-text-secondary transition-colors hover:text-th-red disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete emoji"
                      >
                        {deletingId === emoji.id ? (
                          <LoadingSpinner size={14} />
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg bg-th-bg-secondary">
          <p className="text-sm text-th-text-muted">
            {canManageServer
              ? 'No custom emojis yet. Upload one above!'
              : 'No custom emojis in this server.'}
          </p>
        </div>
      )}
    </div>
  );
}

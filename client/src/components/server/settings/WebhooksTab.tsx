import { useState, useEffect, useCallback } from 'react';
import type { WebhookInfo, Webhook, Channel } from '@harmonium/shared';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';
import { getWebhooks, createWebhook, deleteWebhook } from '../../../api/webhooks.js';
import { useChannelStore } from '../../../stores/channel.store.js';

interface WebhooksTabProps {
  currentServerId: string | null;
  canManageServer: boolean;
}

export function WebhooksTab({ currentServerId, canManageServer }: WebhooksTabProps) {
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createdWebhook, setCreatedWebhook] = useState<Webhook | null>(null);

  const channels = useChannelStore((s) =>
    currentServerId ? (s.channels.get(currentServerId) ?? []) : [],
  );
  const textChannels = channels.filter((c: Channel) => c.type === 'text');

  const fetchData = useCallback(async () => {
    if (!currentServerId || !canManageServer) return;
    setIsLoading(true);
    setError('');
    try {
      const fetched = await getWebhooks(currentServerId);
      setWebhooks(fetched);
    } catch {
      // May not have permission
    } finally {
      setIsLoading(false);
    }
  }, [currentServerId, canManageServer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!currentServerId || !newName.trim() || !newChannelId) return;
    setIsCreating(true);
    setError('');
    try {
      const webhook = await createWebhook(currentServerId, {
        name: newName.trim(),
        channelId: newChannelId,
      });
      setCreatedWebhook(webhook);
      setWebhooks((prev) => [...prev, {
        id: webhook.id,
        serverId: webhook.serverId,
        channelId: webhook.channelId,
        name: webhook.name,
        avatarUrl: webhook.avatarUrl,
        createdBy: webhook.createdBy,
        createdAt: webhook.createdAt,
      }]);
      setNewName('');
      setNewChannelId('');
      setShowCreateForm(false);
    } catch {
      setError('Failed to create webhook.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!currentServerId) return;
    setDeletingId(webhookId);
    setError('');
    try {
      await deleteWebhook(currentServerId, webhookId);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      if (createdWebhook?.id === webhookId) {
        setCreatedWebhook(null);
      }
    } catch {
      setError('Failed to delete webhook.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyUrl = (webhookId: string) => {
    if (!createdWebhook || createdWebhook.id !== webhookId) return;
    const url = `${window.location.origin}/api/webhooks/${webhookId}/${createdWebhook.token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(webhookId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find((c: Channel) => c.id === channelId);
    return channel ? `#${channel.name}` : `#unknown`;
  };

  if (!canManageServer) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Webhooks</h2>
        <p className="text-sm text-th-text-muted">
          You need the Manage Server permission to manage webhooks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Webhooks</h2>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create Webhook
          </button>
        )}
      </div>

      {error && <p className="text-sm text-th-red">{error}</p>}

      {/* Created webhook URL display */}
      {createdWebhook && (
        <div className="rounded-lg border border-th-brand/30 bg-th-brand/10 px-4 py-3">
          <p className="mb-1 text-sm font-medium text-white">
            Webhook URL for "{createdWebhook.name}"
          </p>
          <p className="mb-2 text-xs text-th-text-muted">
            Copy this URL now. The token will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-th-bg-secondary px-3 py-1.5 text-xs text-th-text-primary font-mono">
              {window.location.origin}/api/webhooks/{createdWebhook.id}/{createdWebhook.token}
            </code>
            <button
              onClick={() => handleCopyUrl(createdWebhook.id)}
              className="rounded p-2 text-th-text-secondary transition-colors hover:text-th-text-primary"
              title="Copy webhook URL"
            >
              {copiedId === createdWebhook.id ? (
                <svg className="h-4 w-4 text-th-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-lg bg-th-bg-secondary p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">New Webhook</h3>
          <div>
            <label className="mb-1 block text-xs font-medium text-th-text-secondary">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Webhook name"
              maxLength={80}
              className="w-full rounded bg-th-bg-primary px-3 py-2 text-sm text-th-text-primary placeholder-th-text-muted outline-none focus:ring-1 focus:ring-th-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-th-text-secondary">
              Channel
            </label>
            <select
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              className="w-full rounded bg-th-bg-primary px-3 py-2 text-sm text-th-text-primary outline-none focus:ring-1 focus:ring-th-brand"
            >
              <option value="">Select a channel</option>
              {textChannels.map((c: Channel) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewName('');
                setNewChannelId('');
              }}
              className="rounded px-3 py-1.5 text-sm text-th-text-secondary hover:text-th-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim() || !newChannelId}
              className="flex items-center gap-2 rounded bg-th-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating && <LoadingSpinner size={14} />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} className="text-th-text-secondary" />
        </div>
      ) : webhooks.length > 0 ? (
        <div className="space-y-2">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="flex items-center gap-3 rounded-lg bg-th-bg-secondary px-4 py-3"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-th-bg-accent">
                <svg className="h-5 w-5 text-th-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-th-text-primary">
                    {webhook.name}
                  </p>
                  <span className="rounded bg-th-brand/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-th-brand">
                    BOT
                  </span>
                </div>
                <p className="text-xs text-th-text-muted">
                  {getChannelName(webhook.channelId)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(webhook.id)}
                disabled={deletingId === webhook.id}
                className="rounded p-2 text-th-text-secondary transition-colors hover:text-th-red disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete webhook"
              >
                {deletingId === webhook.id ? (
                  <LoadingSpinner size={14} />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg bg-th-bg-secondary">
          <p className="text-sm text-th-text-muted">No webhooks configured.</p>
        </div>
      )}
    </div>
  );
}

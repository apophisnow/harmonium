import { useState, useEffect, useCallback } from 'react';
import { getAuditLog } from '../../../api/audit-log.js';
import { AuditLogAction } from '@harmonium/shared';
import type { AuditLogEntry } from '@harmonium/shared';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface AuditLogTabProps {
  serverId: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  [AuditLogAction.SERVER_UPDATE]: 'Updated server',
  [AuditLogAction.CHANNEL_CREATE]: 'Created channel',
  [AuditLogAction.CHANNEL_UPDATE]: 'Updated channel',
  [AuditLogAction.CHANNEL_DELETE]: 'Deleted channel',
  [AuditLogAction.ROLE_CREATE]: 'Created role',
  [AuditLogAction.ROLE_UPDATE]: 'Updated role',
  [AuditLogAction.ROLE_DELETE]: 'Deleted role',
  [AuditLogAction.MEMBER_KICK]: 'Kicked member',
  [AuditLogAction.MEMBER_BAN]: 'Banned member',
  [AuditLogAction.MEMBER_UNBAN]: 'Unbanned member',
  [AuditLogAction.INVITE_CREATE]: 'Created invite',
  [AuditLogAction.INVITE_DELETE]: 'Deleted invite',
};

const ACTION_OPTIONS = Object.entries(AuditLogAction).map(([, value]) => ({
  value,
  label: ACTION_LABELS[value] ?? value,
}));

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function ChangesDisplay({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {Object.entries(changes).map(([key, value]) => {
        const change = value as { old?: unknown; new?: unknown } | unknown;
        if (change && typeof change === 'object' && 'new' in change) {
          const typed = change as { old?: unknown; new?: unknown };
          return (
            <p key={key} className="text-xs text-th-text-muted">
              <span className="font-medium">{key}:</span>{' '}
              {typed.old !== undefined && (
                <>
                  <span className="line-through">{String(typed.old)}</span>
                  {' -> '}
                </>
              )}
              <span>{String(typed.new)}</span>
            </p>
          );
        }
        return (
          <p key={key} className="text-xs text-th-text-muted">
            <span className="font-medium">{key}:</span> {String(value)}
          </p>
        );
      })}
    </div>
  );
}

export function AuditLogTab({ serverId }: AuditLogTabProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const LIMIT = 50;

  const fetchEntries = useCallback(
    async (before?: string) => {
      if (!serverId) return;
      setIsLoading(true);
      setError('');
      try {
        const params: { action?: string; before?: string; limit?: number } = {
          limit: LIMIT,
        };
        if (actionFilter) params.action = actionFilter;
        if (before) params.before = before;

        const fetched = await getAuditLog(serverId, params);
        if (before) {
          setEntries((prev) => [...prev, ...fetched]);
        } else {
          setEntries(fetched);
        }
        setHasMore(fetched.length === LIMIT);
      } catch {
        setError('Failed to load audit log.');
      } finally {
        setIsLoading(false);
      }
    },
    [serverId, actionFilter],
  );

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleLoadMore = () => {
    if (entries.length === 0 || !hasMore) return;
    const lastEntry = entries[entries.length - 1];
    fetchEntries(lastEntry.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Audit Log</h2>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded bg-th-bg-secondary px-3 py-1.5 text-sm text-th-text-primary outline-none border border-th-border focus:border-th-brand"
        >
          <option value="">All Actions</option>
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-th-red">{error}</p>}

      {isLoading && entries.length === 0 ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} className="text-th-text-secondary" />
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-lg bg-th-bg-secondary px-4 py-3"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-th-bg-primary text-xs font-bold text-th-text-secondary">
                {entry.actor?.avatarUrl ? (
                  <img
                    src={entry.actor.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  (entry.actor?.username?.[0] ?? '?').toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-th-text-primary">
                  <span className="font-semibold">
                    {entry.actor?.username ?? 'Unknown'}
                  </span>{' '}
                  <span className="text-th-text-secondary">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  {entry.targetId && (
                    <span className="text-th-text-muted">
                      {' '}
                      ({entry.targetType}: {entry.targetId})
                    </span>
                  )}
                </p>
                {entry.reason && (
                  <p className="mt-0.5 text-xs text-th-text-muted">
                    Reason: {entry.reason}
                  </p>
                )}
                <ChangesDisplay changes={entry.changes} />
              </div>
              <span className="flex-shrink-0 text-xs text-th-text-muted">
                {formatTimestamp(entry.createdAt)}
              </span>
            </div>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="rounded bg-th-bg-secondary px-4 py-2 text-sm font-medium text-th-text-secondary transition-colors hover:bg-th-bg-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <LoadingSpinner size={14} /> : 'Load More'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg bg-th-bg-secondary">
          <p className="text-sm text-th-text-muted">No audit log entries.</p>
        </div>
      )}
    </div>
  );
}

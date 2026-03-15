import { useState, useEffect, useCallback } from 'react';
import type { Ban } from '@harmonium/shared';
import { getBans, unbanMember } from '../../../api/bans.js';
import { UserAvatar } from '../../user/UserAvatar.js';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface BansTabProps {
  currentServerId: string | null;
}

export function BansTab({ currentServerId }: BansTabProps) {
  const [bans, setBans] = useState<Ban[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [unbanningUserId, setUnbanningUserId] = useState<string | null>(null);
  const [confirmUnbanUserId, setConfirmUnbanUserId] = useState<string | null>(null);

  const fetchBans = useCallback(async () => {
    if (!currentServerId) return;
    setIsLoading(true);
    setError('');
    try {
      const fetched = await getBans(currentServerId);
      setBans(fetched);
    } catch {
      setError('Failed to load bans.');
    } finally {
      setIsLoading(false);
    }
  }, [currentServerId]);

  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  const handleUnban = async (userId: string) => {
    if (!currentServerId) return;
    setUnbanningUserId(userId);
    setError('');
    try {
      await unbanMember(currentServerId, userId);
      setBans((prev) => prev.filter((b) => b.user.id !== userId));
      setConfirmUnbanUserId(null);
    } catch {
      setError('Failed to unban user.');
    } finally {
      setUnbanningUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Bans</h2>
        <span className="text-sm text-th-text-secondary">
          {bans.length} ban{bans.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <p className="text-sm text-th-red">{error}</p>}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <LoadingSpinner size={24} />
        </div>
      ) : bans.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg bg-th-bg-secondary">
          <p className="text-sm text-th-text-muted">No banned users</p>
        </div>
      ) : (
        <div className="space-y-1">
          {bans.map((ban) => {
            const username = ban.user.username;
            return (
              <div key={ban.user.id} className="flex items-center gap-3 rounded-lg bg-th-bg-secondary px-3 py-2">
                <UserAvatar
                  username={username}
                  avatarUrl={ban.user.avatarUrl}
                  status="offline"
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-th-text-primary">
                      {username}
                    </span>
                    {ban.user.discriminator && (
                      <span className="text-xs text-th-text-muted">#{ban.user.discriminator}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-th-text-secondary">
                    {ban.reason && <span className="truncate">{ban.reason}</span>}
                    {ban.reason && <span>-</span>}
                    <span>{new Date(ban.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div>
                  {confirmUnbanUserId === ban.user.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmUnbanUserId(null)}
                        className="text-xs text-th-text-secondary hover:underline"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUnban(ban.user.id)}
                        disabled={unbanningUserId === ban.user.id}
                        className="flex items-center gap-1 rounded bg-th-brand px-2 py-0.5 text-xs font-medium text-white hover:bg-th-brand-hover disabled:opacity-50"
                      >
                        {unbanningUserId === ban.user.id && <LoadingSpinner size={10} />}
                        Confirm
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmUnbanUserId(ban.user.id)}
                      className="rounded px-2 py-1 text-xs text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary transition-colors"
                    >
                      Unban
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Invite } from '@harmonium/shared';
import { getInviteInfo, acceptInvite } from '../api/invites.js';
import { useAuthStore } from '../stores/auth.store.js';
import { useServerStore } from '../stores/server.store.js';
import { LoadingSpinner } from '../components/shared/LoadingSpinner.js';
import { getInitials } from '../lib/formatters.js';

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [invite, setInvite] = useState<Invite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;

    getInviteInfo(code)
      .then(setInvite)
      .catch(() => setError('This invite is invalid or has expired.'))
      .finally(() => setIsLoading(false));
  }, [code]);

  const handleAccept = async () => {
    if (!code || !isAuthenticated) {
      navigate(`/login?redirect=/invite/${code}`);
      return;
    }

    setIsAccepting(true);
    setError('');

    try {
      const result = await acceptInvite(code);
      // Refresh server list so the new server is available before navigating
      await useServerStore.getState().fetchServers();
      navigate(`/channels/${result.serverId}`);
    } catch {
      setError('Failed to join the server. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg-tertiary">
        <LoadingSpinner size={48} className="text-th-brand" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg-tertiary p-4">
      <div className="w-full max-w-md rounded-lg bg-th-bg-secondary p-8 text-center shadow-xl">
        {error && !invite ? (
          <>
            <h2 className="mb-2 text-2xl font-bold text-white">
              Invalid Invite
            </h2>
            <p className="mb-6 text-th-text-secondary">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="rounded bg-th-brand px-6 py-2 text-sm font-medium text-white hover:bg-th-brand-hover transition-colors"
            >
              Go Home
            </button>
          </>
        ) : invite ? (
          <>
            <p className="mb-4 text-sm uppercase text-th-text-secondary">
              You have been invited to join
            </p>

            {/* Server icon */}
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-th-bg-primary">
              {invite.server?.iconUrl ? (
                <img
                  src={invite.server.iconUrl}
                  alt={invite.server.name}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {getInitials(invite.server?.name ?? 'Server')}
                </span>
              )}
            </div>

            <h2 className="mb-2 text-2xl font-bold text-white">
              {invite.server?.name ?? 'Unknown Server'}
            </h2>

            {invite.inviter && (
              <p className="mb-6 text-sm text-th-text-secondary">
                Invited by {invite.inviter.username}
              </p>
            )}

            {error && <p className="mb-4 text-sm text-th-red">{error}</p>}

            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="flex w-full items-center justify-center gap-2 rounded bg-th-brand px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAccepting && <LoadingSpinner size={16} />}
              {isAuthenticated ? 'Accept Invite' : 'Log In to Accept'}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

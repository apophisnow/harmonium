import type { Invite } from '@harmonium/shared';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface InvitesTabProps {
  canCreateInvite: boolean;
  canManageServer: boolean;
  invites: Invite[];
  isLoadingInvites: boolean;
  isCreatingInvite: boolean;
  inviteError: string;
  copiedCode: string | null;
  deletingInviteCode: string | null;
  handleCreateInvite: () => void;
  handleDeleteInvite: (code: string) => void;
  handleCopyInvite: (code: string) => void;
}

export function InvitesTab({
  canCreateInvite,
  canManageServer,
  invites,
  isLoadingInvites,
  isCreatingInvite,
  inviteError,
  copiedCode,
  deletingInviteCode,
  handleCreateInvite,
  handleDeleteInvite,
  handleCopyInvite,
}: InvitesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Invites</h2>
        {canCreateInvite && (
          <button
            onClick={handleCreateInvite}
            disabled={isCreatingInvite}
            className="flex items-center gap-2 rounded bg-[#5865f2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreatingInvite ? (
              <LoadingSpinner size={14} />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            )}
            Generate Invite Link
          </button>
        )}
      </div>

      {inviteError && <p className="text-sm text-[#ed4245]">{inviteError}</p>}

      {isLoadingInvites ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} className="text-[#96989d]" />
        </div>
      ) : invites.length > 0 ? (
        <div className="space-y-2">
          {invites.map((invite) => {
            const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
            const isMaxed = invite.maxUses !== null && invite.useCount >= invite.maxUses;

            return (
              <div
                key={invite.code}
                className={`flex items-center gap-3 rounded-lg bg-[#2f3136] px-4 py-3 ${isExpired || isMaxed ? 'opacity-50' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-mono text-[#dcddde]">
                    {window.location.origin}/invite/{invite.code}
                  </p>
                  <p className="text-xs text-[#72767d]">
                    {invite.useCount} use{invite.useCount !== 1 ? 's' : ''}
                    {invite.maxUses !== null && ` / ${invite.maxUses} max`}
                    {isExpired && ' \u00b7 Expired'}
                  </p>
                </div>
                <button
                  onClick={() => handleCopyInvite(invite.code)}
                  className="rounded p-2 text-[#96989d] transition-colors hover:text-[#dcddde]"
                  title="Copy invite link"
                >
                  {copiedCode === invite.code ? (
                    <svg className="h-4 w-4 text-[#3ba55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
                {canManageServer && (
                  <button
                    onClick={() => handleDeleteInvite(invite.code)}
                    disabled={deletingInviteCode === invite.code}
                    className="rounded p-2 text-[#96989d] transition-colors hover:text-[#ed4245] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete invite"
                  >
                    {deletingInviteCode === invite.code ? (
                      <LoadingSpinner size={14} />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg bg-[#2f3136]">
          <p className="text-sm text-[#72767d]">No active invites.</p>
        </div>
      )}
    </div>
  );
}

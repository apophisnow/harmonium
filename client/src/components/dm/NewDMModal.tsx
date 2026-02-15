import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../stores/ui.store.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { useMemberStore } from '../../stores/member.store.js';
import { useDMStore } from '../../stores/dm.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { UserAvatar } from '../user/UserAvatar.js';
import type { PublicUser } from '@harmonium/shared';

export function NewDMModal() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const navigate = useNavigate();

  const currentUserId = useAuthStore((s) => s.user?.id);
  const members = useMemberStore((s) => s.members);
  const openChannel = useDMStore((s) => s.openChannel);
  const setCurrentDMChannel = useDMStore((s) => s.setCurrentDMChannel);
  const presences = usePresenceStore((s) => s.presences);

  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Collect all unique users from all servers (excluding self)
  const allUsers = useMemo(() => {
    const userMap = new Map<string, PublicUser>();
    for (const memberList of members.values()) {
      for (const member of memberList) {
        if (member.userId !== currentUserId && member.user) {
          userMap.set(member.userId, member.user);
        }
      }
    }
    return Array.from(userMap.values());
  }, [members, currentUserId]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return allUsers;
    const q = search.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.discriminator.includes(q),
    );
  }, [allUsers, search]);

  if (activeModal !== 'newDM') return null;

  const handleSelect = async (userId: string) => {
    setIsLoading(true);
    try {
      const channelId = await openChannel(userId);
      setCurrentDMChannel(channelId);
      closeModal();
      navigate(`/channels/@me/${channelId}`);
    } catch (err) {
      console.error('Failed to open DM channel:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-th-bg-secondary p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-white">New Message</h2>
        <p className="mt-1 text-sm text-th-text-secondary">
          Select a user to start a conversation.
        </p>

        {/* Search input */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username..."
          autoFocus
          className="mt-3 w-full rounded bg-th-bg-primary px-3 py-2 text-sm text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
        />

        {/* User list */}
        <div className="mt-3 max-h-60 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <p className="py-4 text-center text-sm text-th-text-secondary">
              {allUsers.length === 0
                ? 'Join a server to find users to message.'
                : 'No users found.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  disabled={isLoading}
                  className="flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors hover:bg-th-bg-primary disabled:opacity-50"
                >
                  <UserAvatar
                    username={user.username}
                    avatarUrl={user.avatarUrl}
                    status={presences.get(user.id) ?? 'offline'}
                    size={36}
                  />
                  <div>
                    <span className="text-sm font-medium text-white">
                      {user.username}
                    </span>
                    <span className="ml-1 text-xs text-th-text-muted">
                      #{user.discriminator}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={closeModal}
            className="rounded px-4 py-2 text-sm text-th-text-secondary hover:text-th-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

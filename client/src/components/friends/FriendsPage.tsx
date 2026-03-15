import { useEffect, useState } from 'react';
import type { Relationship } from '@harmonium/shared';
import { useRelationshipStore } from '../../stores/relationship.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';
import { AddFriend } from './AddFriend.js';

type Tab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

export function FriendsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('online');
  const relationships = useRelationshipStore((s) => s.relationships);
  const fetchRelationships = useRelationshipStore((s) => s.fetchRelationships);
  const acceptFriendRequest = useRelationshipStore((s) => s.acceptFriendRequest);
  const declineFriendRequest = useRelationshipStore((s) => s.declineFriendRequest);
  const removeFriend = useRelationshipStore((s) => s.removeFriend);
  const blockUser = useRelationshipStore((s) => s.blockUser);
  const unblockUser = useRelationshipStore((s) => s.unblockUser);
  const presences = usePresenceStore((s) => s.presences);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRelationships().finally(() => setIsLoading(false));
  }, [fetchRelationships]);

  const allRelationships = Array.from(relationships.values());
  const friends = allRelationships.filter((r) => r.type === 'friend');
  const pending = allRelationships.filter(
    (r) => r.type === 'pending_incoming' || r.type === 'pending_outgoing',
  );
  const blocked = allRelationships.filter((r) => r.type === 'blocked');

  const onlineFriends = friends.filter((r) => {
    const status = presences.get(r.user.id);
    return status && status !== 'offline';
  });

  const getDisplayList = (): Relationship[] => {
    switch (activeTab) {
      case 'online':
        return onlineFriends;
      case 'all':
        return friends;
      case 'pending':
        return pending;
      case 'blocked':
        return blocked;
      default:
        return [];
    }
  };

  const handleAction = async (action: () => Promise<void>, userId: string) => {
    setActionLoading(userId);
    try {
      await action();
    } catch {
      // Toast handles errors
    } finally {
      setActionLoading(null);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'online', label: 'Online', count: onlineFriends.length },
    { id: 'all', label: 'All', count: friends.length },
    { id: 'pending', label: 'Pending', count: pending.length },
    { id: 'blocked', label: 'Blocked', count: blocked.length },
    { id: 'add', label: 'Add Friend' },
  ];

  const displayList = getDisplayList();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size={32} className="text-th-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-th-bg-primary">
      {/* Header with tabs */}
      <div className="flex items-center gap-4 border-b border-th-border px-4 py-3">
        <h1 className="text-base font-semibold text-th-text-primary">Friends</h1>
        <div className="h-5 w-px bg-th-border" />
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? tab.id === 'add'
                    ? 'bg-th-green text-white'
                    : 'bg-th-bg-secondary text-th-text-primary'
                  : 'text-th-text-secondary hover:bg-th-bg-secondary hover:text-th-text-primary'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 rounded-full bg-th-bg-tertiary px-1.5 py-0.5 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Add Friend form */}
      {activeTab === 'add' && <AddFriend />}

      {/* List */}
      {activeTab !== 'add' && (
        <div className="flex-1 overflow-y-auto">
          {displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-th-text-secondary">
              <p className="text-sm">
                {activeTab === 'online' && 'No friends are online right now.'}
                {activeTab === 'all' && 'You have no friends yet. Add some!'}
                {activeTab === 'pending' && 'No pending friend requests.'}
                {activeTab === 'blocked' && 'No blocked users.'}
              </p>
            </div>
          ) : (
            <div className="px-4 py-2">
              <h2 className="mb-2 text-xs font-semibold uppercase text-th-text-secondary">
                {activeTab === 'online' && `Online -- ${displayList.length}`}
                {activeTab === 'all' && `All Friends -- ${displayList.length}`}
                {activeTab === 'pending' && `Pending -- ${displayList.length}`}
                {activeTab === 'blocked' && `Blocked -- ${displayList.length}`}
              </h2>
              {displayList.map((rel) => (
                <FriendRow
                  key={rel.user.id}
                  relationship={rel}
                  status={presences.get(rel.user.id) ?? 'offline'}
                  isActionLoading={actionLoading === rel.user.id}
                  onAccept={() =>
                    handleAction(() => acceptFriendRequest(rel.user.id), rel.user.id)
                  }
                  onDecline={() =>
                    handleAction(() => declineFriendRequest(rel.user.id), rel.user.id)
                  }
                  onRemove={() =>
                    handleAction(() => removeFriend(rel.user.id), rel.user.id)
                  }
                  onBlock={() =>
                    handleAction(() => blockUser(rel.user.id), rel.user.id)
                  }
                  onUnblock={() =>
                    handleAction(() => unblockUser(rel.user.id), rel.user.id)
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FriendRowProps {
  relationship: Relationship;
  status: string;
  isActionLoading: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}

function FriendRow({
  relationship,
  status,
  isActionLoading,
  onAccept,
  onDecline,
  onRemove,
  onBlock,
  onUnblock,
}: FriendRowProps) {
  const { user, type } = relationship;

  return (
    <div className="group flex items-center justify-between rounded px-2 py-2 hover:bg-th-bg-secondary">
      <div className="flex items-center gap-3">
        <UserAvatar
          username={user.username}
          avatarUrl={user.avatarUrl}
          status={status as 'online' | 'idle' | 'dnd' | 'offline'}
          size={36}
        />
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-th-text-primary">
              {user.username}
            </span>
            <span className="text-xs text-th-text-secondary">
              #{user.discriminator}
            </span>
          </div>
          <span className="text-xs text-th-text-secondary">
            {type === 'friend' && (status === 'offline' ? 'Offline' : status.charAt(0).toUpperCase() + status.slice(1))}
            {type === 'pending_incoming' && 'Incoming Friend Request'}
            {type === 'pending_outgoing' && 'Outgoing Friend Request'}
            {type === 'blocked' && 'Blocked'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isActionLoading ? (
          <LoadingSpinner size={16} />
        ) : (
          <>
            {type === 'pending_incoming' && (
              <>
                <ActionButton
                  onClick={onAccept}
                  title="Accept"
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  }
                  className="text-th-green hover:bg-th-green/10"
                />
                <ActionButton
                  onClick={onDecline}
                  title="Decline"
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  }
                  className="text-th-red hover:bg-th-red/10"
                />
              </>
            )}
            {type === 'pending_outgoing' && (
              <ActionButton
                onClick={onDecline}
                title="Cancel"
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                }
                className="text-th-red hover:bg-th-red/10"
              />
            )}
            {type === 'friend' && (
              <>
                <ActionButton
                  onClick={onRemove}
                  title="Remove Friend"
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="18" y1="11" x2="23" y2="11" />
                    </svg>
                  }
                  className="text-th-text-secondary hover:text-th-red hover:bg-th-red/10 opacity-0 group-hover:opacity-100"
                />
                <ActionButton
                  onClick={onBlock}
                  title="Block"
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                  }
                  className="text-th-text-secondary hover:text-th-red hover:bg-th-red/10 opacity-0 group-hover:opacity-100"
                />
              </>
            )}
            {type === 'blocked' && (
              <ActionButton
                onClick={onUnblock}
                title="Unblock"
                icon={
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                }
                className="text-th-red hover:bg-th-red/10"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  icon,
  className = '',
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-th-bg-tertiary transition-colors ${className}`}
    >
      {icon}
    </button>
  );
}

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDMStore } from '../../stores/dm.store.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { UserAvatar } from '../user/UserAvatar.js';

export function DMSidebar() {
  const navigate = useNavigate();
  const { channelId: activeChannelId } = useParams<{ channelId?: string }>();

  const channels = useDMStore((s) => s.channels);
  const fetchChannels = useDMStore((s) => s.fetchChannels);
  const setCurrentDMChannel = useDMStore((s) => s.setCurrentDMChannel);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const ownPresence = usePresenceStore((s) => user ? s.presences.get(user.id) : undefined);
  const presences = usePresenceStore((s) => s.presences);

  const openModal = useUIStore((s) => s.openModal);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleChannelClick = (channelId: string) => {
    setCurrentDMChannel(channelId);
    navigate(`/channels/@me/${channelId}`);
  };

  return (
    <div className="flex h-full w-60 flex-col bg-th-bg-secondary">
      {/* Header */}
      <div className="flex h-12 items-center border-b border-th-border px-4 shadow-sm">
        <h2 className="text-base font-semibold text-white">
          Direct Messages
        </h2>
      </div>

      {/* New DM button */}
      <div className="px-2 pt-2">
        <button
          onClick={() => openModal('newDM')}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Message
        </button>
      </div>

      {/* DM channel list */}
      <div className="flex-1 overflow-y-auto px-2 pt-2">
        {channels.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-th-text-secondary">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {channels.map((channel) => {
              const isActive = activeChannelId === channel.id;
              const otherUserPresence = presences.get(channel.user.id);

              return (
                <button
                  key={channel.id}
                  onClick={() => handleChannelClick(channel.id)}
                  className={`flex w-full items-center gap-3 rounded px-2 py-1.5 transition-colors ${
                    isActive
                      ? 'bg-th-bg-primary text-white'
                      : 'text-th-text-secondary hover:bg-th-bg-primary/50 hover:text-th-text-primary'
                  }`}
                >
                  <UserAvatar
                    username={channel.user.username}
                    avatarUrl={channel.user.avatarUrl}
                    status={otherUserPresence ?? 'offline'}
                    size={32}
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">
                      {channel.user.username}
                    </p>
                    {channel.lastMessage && (
                      <p className="truncate text-xs text-th-text-muted">
                        {channel.lastMessage.content ?? ''}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* User panel at bottom */}
      <div className="flex items-center gap-2 border-t border-th-border bg-th-bg-card px-2 py-2">
        <UserAvatar
          username={user?.username ?? ''}
          avatarUrl={user?.avatarUrl}
          status={ownPresence ?? 'online'}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {user?.username}
          </p>
          <p className="truncate text-xs text-th-text-secondary">
            #{user?.discriminator}
          </p>
        </div>
        <button
          onClick={() => openModal('userSettings')}
          className="rounded p-1.5 text-th-text-secondary hover:text-th-text-primary transition-colors"
          title="User Settings"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <button
          onClick={logout}
          className="rounded p-1.5 text-th-text-secondary hover:text-th-text-primary transition-colors"
          title="Log Out"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

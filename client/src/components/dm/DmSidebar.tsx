import { useNavigate } from 'react-router-dom';
import { useDmStore } from '../../stores/dm.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { UserAvatar } from '../user/UserAvatar.js';
import type { DmChannel } from '@harmonium/shared';

function getDmDisplayName(channel: DmChannel): string {
  if (channel.name) return channel.name;
  if (channel.recipients.length === 0) return 'Saved Messages';
  return channel.recipients.map((r) => r.username).join(', ');
}

export function DmSidebar() {
  const dmChannels = useDmStore((s) => s.dmChannels);
  const currentDmChannelId = useDmStore((s) => s.currentDmChannelId);
  const setCurrentDmChannel = useDmStore((s) => s.setCurrentDmChannel);
  const closeDm = useDmStore((s) => s.closeDm);
  const setCurrentChannel = useChannelStore((s) => s.setCurrentChannel);
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar);
  const navigate = useNavigate();

  const handleChannelClick = (channelId: string) => {
    setCurrentDmChannel(channelId);
    setCurrentChannel(channelId);
    navigate(`/channels/@me/${channelId}`);
    closeMobileSidebar();
  };

  const handleCloseDm = async (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    await closeDm(channelId);
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2">
      <h3 className="mb-1 px-2 text-xs font-semibold uppercase text-th-text-secondary">
        Direct Messages
      </h3>
      {dmChannels.length === 0 ? (
        <p className="px-2 py-4 text-sm text-th-text-secondary">
          No direct messages yet
        </p>
      ) : (
        <div className="space-y-0.5">
          {dmChannels.map((channel) => (
            <DmChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === currentDmChannelId}
              onClick={() => handleChannelClick(channel.id)}
              onClose={(e) => handleCloseDm(e, channel.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DmChannelItem({
  channel,
  isActive,
  onClick,
  onClose,
}: {
  channel: DmChannel;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const firstRecipient = channel.recipients[0];
  const presence = usePresenceStore((s) =>
    firstRecipient ? s.presences.get(firstRecipient.id) : undefined,
  );

  const displayName = getDmDisplayName(channel);

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded px-2 py-1.5 text-left transition-colors ${
        isActive
          ? 'bg-th-bg-active text-th-text-primary'
          : 'text-th-text-secondary hover:bg-th-bg-secondary hover:text-th-text-primary'
      }`}
    >
      {channel.type === 'dm' && firstRecipient ? (
        <UserAvatar
          username={firstRecipient.username}
          avatarUrl={firstRecipient.avatarUrl}
          status={presence ?? 'offline'}
          size={32}
        />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-th-bg-tertiary text-th-text-secondary">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {channel.type === 'group_dm' && (
          <p className="truncate text-xs text-th-text-secondary">
            {channel.recipients.length + 1} Members
          </p>
        )}
      </div>

      <button
        onClick={onClose}
        className="hidden flex-shrink-0 rounded p-0.5 text-th-text-secondary hover:text-th-text-primary group-hover:block"
        title="Close DM"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </button>
  );
}

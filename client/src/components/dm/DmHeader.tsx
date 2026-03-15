import type { DmChannel } from '@harmonium/shared';
import { usePresenceStore } from '../../stores/presence.store.js';
import { UserAvatar } from '../user/UserAvatar.js';

interface DmHeaderProps {
  channel: DmChannel;
}

function getDmDisplayName(channel: DmChannel): string {
  if (channel.name) return channel.name;
  if (channel.recipients.length === 0) return 'Saved Messages';
  return channel.recipients.map((r) => r.username).join(', ');
}

export function DmHeader({ channel }: DmHeaderProps) {
  const firstRecipient = channel.recipients[0];
  const presence = usePresenceStore((s) =>
    firstRecipient ? s.presences.get(firstRecipient.id) : undefined,
  );

  const displayName = getDmDisplayName(channel);

  return (
    <div className="flex h-12 items-center gap-3 border-b border-th-border px-4 shadow-sm">
      {channel.type === 'dm' && firstRecipient ? (
        <UserAvatar
          username={firstRecipient.username}
          avatarUrl={firstRecipient.avatarUrl}
          status={presence ?? 'offline'}
          size={24}
        />
      ) : (
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-th-bg-tertiary text-th-text-secondary">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold text-white">
          {displayName}
        </h2>
      </div>

      {channel.type === 'dm' && firstRecipient && presence && presence !== 'offline' && (
        <span className="text-xs text-th-text-secondary capitalize">
          {presence}
        </span>
      )}

      {channel.type === 'group_dm' && (
        <span className="text-xs text-th-text-secondary">
          {channel.recipients.length + 1} Members
        </span>
      )}
    </div>
  );
}

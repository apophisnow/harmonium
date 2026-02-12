import type { UserStatus } from '@harmonium/shared';
import { getInitials } from '../../lib/formatters.js';

interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  status?: UserStatus;
  size?: number;
  showStatus?: boolean;
  className?: string;
}

const statusColors: Record<UserStatus, string> = {
  online: 'bg-th-green',
  idle: 'bg-th-yellow',
  dnd: 'bg-th-red',
  offline: 'bg-th-text-muted',
};

export function UserAvatar({
  username,
  avatarUrl,
  status = 'offline',
  size = 40,
  showStatus = true,
  className = '',
}: UserAvatarProps) {
  const dotSize = size >= 40 ? 14 : 10;
  const dotOffset = size >= 40 ? -2 : -1;

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-th-brand text-white font-medium"
          style={{ fontSize: size * 0.4 }}
        >
          {getInitials(username)}
        </div>
      )}
      {showStatus && (
        <div
          className={`absolute rounded-full border-[3px] border-th-border ${statusColors[status]}`}
          style={{
            width: dotSize,
            height: dotSize,
            bottom: dotOffset,
            right: dotOffset,
          }}
        />
      )}
    </div>
  );
}

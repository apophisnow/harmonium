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
  online: 'bg-[#3ba55c]',
  idle: 'bg-[#faa61a]',
  dnd: 'bg-[#ed4245]',
  offline: 'bg-[#747f8d]',
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
          className="flex h-full w-full items-center justify-center rounded-full bg-[#5865f2] text-white font-medium"
          style={{ fontSize: size * 0.4 }}
        >
          {getInitials(username)}
        </div>
      )}
      {showStatus && (
        <div
          className={`absolute rounded-full border-[3px] border-[#2f3136] ${statusColors[status]}`}
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

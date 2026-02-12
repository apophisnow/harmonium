import { getInitials } from '../../lib/formatters.js';
import { Tooltip } from '../shared/Tooltip.js';

interface ServerIconProps {
  name: string;
  iconUrl?: string | null;
  isActive?: boolean;
  hasNotification?: boolean;
  onClick?: () => void;
}

export function ServerIcon({
  name,
  iconUrl,
  isActive = false,
  hasNotification = false,
  onClick,
}: ServerIconProps) {
  return (
    <div className="relative flex items-center justify-center mb-2 group">
      {/* Active / hover indicator pill */}
      <div
        className={`absolute left-0 w-1 rounded-r-full bg-white transition-all ${
          isActive
            ? 'h-10'
            : hasNotification
              ? 'h-2'
              : 'h-0 group-hover:h-5'
        }`}
      />

      <Tooltip content={name} position="right">
        <button
          onClick={onClick}
          className={`flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-200 ${
            isActive
              ? 'rounded-2xl bg-th-brand'
              : 'rounded-3xl hover:rounded-2xl bg-th-bg-primary hover:bg-th-brand'
          }`}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium text-white">
              {getInitials(name)}
            </span>
          )}
        </button>
      </Tooltip>
    </div>
  );
}

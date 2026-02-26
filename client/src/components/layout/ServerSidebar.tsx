import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../stores/server.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useUnreadStore } from '../../stores/unread.store.js';
import { ServerIcon } from '../server/ServerIcon.js';
import { Tooltip } from '../shared/Tooltip.js';

export function ServerSidebar() {
  const servers = useServerStore((s) => s.servers);
  const currentServerId = useServerStore((s) => s.currentServerId);
  const setCurrentServer = useServerStore((s) => s.setCurrentServer);
  const openModal = useUIStore((s) => s.openModal);
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar);
  const navigate = useNavigate();

  const serverList = Array.from(servers.values());

  const handleServerClick = (serverId: string) => {
    setCurrentServer(serverId);
    navigate(`/channels/${serverId}`);
    closeMobileSidebar();
  };

  return (
    <div className="flex h-full w-[72px] flex-col items-center bg-th-bg-tertiary py-3 overflow-y-auto scrollbar-none">
      {/* Home button */}
      <div className="mb-2">
        <Tooltip content="Direct Messages" position="right">
          <button
            onClick={() => {
              setCurrentServer(null);
              navigate('/channels/@me');
            }}
            className={`flex h-12 w-12 items-center justify-center transition-all duration-200 ${
              currentServerId === null
                ? 'rounded-2xl bg-th-brand'
                : 'rounded-3xl bg-th-bg-primary hover:rounded-2xl hover:bg-th-brand'
            }`}
          >
            <svg
              className="h-7 w-7 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19.73 4.87l-3.98-.64-1.02-4.05L12 3.07 9.27.18 8.25 4.23l-3.98.64.37 2.97-3.64 2.14 2.56 2.14-.37 2.97 3.98.64 1.02 4.05L12 16.93l2.73 2.89 1.02-4.05 3.98-.64-.37-2.97 3.64-2.14-2.56-2.14.37-2.97z" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Separator */}
      <div className="mx-auto mb-2 h-0.5 w-8 rounded-full bg-th-bg-primary" />

      {/* Server list */}
      {serverList.map((server) => (
        <ServerIconWithUnread
          key={server.id}
          serverId={server.id}
          name={server.name}
          iconUrl={server.iconUrl}
          isActive={server.id === currentServerId}
          onClick={() => handleServerClick(server.id)}
        />
      ))}

      {/* Separator */}
      <div className="mx-auto my-1 h-0.5 w-8 rounded-full bg-th-bg-primary" />

      {/* Add server button */}
      <Tooltip content="Add a Server" position="right">
        <button
          onClick={() => openModal('createServer')}
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-th-bg-primary text-th-green transition-all duration-200 hover:rounded-2xl hover:bg-th-green hover:text-white"
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}

function ServerIconWithUnread({
  serverId,
  name,
  iconUrl,
  isActive,
  onClick,
}: {
  serverId: string;
  name: string;
  iconUrl?: string | null;
  isActive: boolean;
  onClick: () => void;
}) {
  const channels = useChannelStore((s) => s.channels.get(serverId));
  const readStates = useUnreadStore((s) => s.readStates);

  // Compute server-level unread info
  let hasUnread = false;
  let mentionCount = 0;

  if (channels) {
    for (const channel of channels) {
      if (channel.type !== 'text') continue;
      const state = readStates.get(channel.id);
      if (state) {
        if (state.mentionCount > 0) {
          mentionCount += state.mentionCount;
          hasUnread = true;
        }
      }
    }
  }

  return (
    <div className="relative">
      <ServerIcon
        name={name}
        iconUrl={iconUrl}
        isActive={isActive}
        hasNotification={hasUnread}
        onClick={onClick}
      />
      {mentionCount > 0 && (
        <div className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-th-red text-white text-xs font-bold px-1 border-2 border-th-bg-tertiary">
          {mentionCount}
        </div>
      )}
    </div>
  );
}

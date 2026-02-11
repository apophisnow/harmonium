import { useEffect } from 'react';
import { useServerStore } from '../../stores/server.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { useVoiceStore } from '../../stores/voice.store.js';
import { ChannelList } from '../channel/ChannelList.js';
import { VoiceControls } from '../voice/VoiceControls.js';
import { UserAvatar } from '../user/UserAvatar.js';

interface ChannelSidebarProps {
  onJoinVoice?: (channelId: string, serverId: string) => void;
  onLeaveVoice?: () => void;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  onStartWebcam?: () => void;
  onStopWebcam?: () => void;
  isWebcamOn?: boolean;
}

export function ChannelSidebar({
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onStartScreenShare,
  onStopScreenShare,
  onStartWebcam,
  onStopWebcam,
  isWebcamOn,
}: ChannelSidebarProps = {}) {
  const currentServerId = useServerStore((s) => s.currentServerId);
  const server = useServerStore((s) =>
    currentServerId ? s.servers.get(currentServerId) : undefined,
  );
  const fetchChannels = useChannelStore((s) => s.fetchChannels);
  const openModal = useUIStore((s) => s.openModal);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const ownPresence = usePresenceStore((s) => user ? s.presences.get(user.id) : undefined);
  const voiceChannelId = useVoiceStore((s) => s.currentChannelId);

  useEffect(() => {
    if (currentServerId) {
      fetchChannels(currentServerId);
    }
  }, [currentServerId, fetchChannels]);

  return (
    <div className="flex h-full w-60 flex-col bg-[#2f3136]">
      {/* Server header */}
      <div className="flex h-12 items-center border-b border-[#202225] px-4 shadow-sm">
        {server ? (
          <div className="flex w-full items-center justify-between">
            <h2 className="truncate text-base font-semibold text-white">
              {server.name}
            </h2>
            <button
              onClick={() => openModal('serverSettings')}
              className="rounded p-1 text-[#96989d] hover:text-[#dcddde] transition-colors"
              title="Server Settings"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>
        ) : (
          <h2 className="text-base font-semibold text-white">
            Direct Messages
          </h2>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {currentServerId ? (
          <>
            <ChannelList serverId={currentServerId} onJoinVoice={onJoinVoice} />
            {/* Sidebar actions */}
            <div className="px-2 py-2 space-y-0.5">
              <button
                onClick={() => openModal('invite')}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-[#96989d] hover:text-[#dcddde] transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Invite People
              </button>
              <button
                onClick={() => openModal('createChannel')}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-[#96989d] hover:text-[#dcddde] transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create Channel
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-[#96989d]">
            Select a server to see channels
          </div>
        )}
      </div>

      {/* Voice controls (shown when in a voice channel) */}
      {voiceChannelId && onLeaveVoice && onToggleMute && onToggleDeafen && onStartScreenShare && onStopScreenShare && onStartWebcam && onStopWebcam && isWebcamOn !== undefined && (
        <VoiceControls
          onLeave={onLeaveVoice}
          onToggleMute={onToggleMute}
          onToggleDeafen={onToggleDeafen}
          onStartWebcam={onStartWebcam}
          onStopWebcam={onStopWebcam}
          isWebcamOn={isWebcamOn}
          onStartScreenShare={onStartScreenShare}
          onStopScreenShare={onStopScreenShare}
        />
      )}

      {/* User panel at bottom */}
      <div className="flex items-center gap-2 border-t border-[#202225] bg-[#292b2f] px-2 py-2">
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
          <p className="truncate text-xs text-[#96989d]">
            #{user?.discriminator}
          </p>
        </div>
        <button
          onClick={() => openModal('editProfile')}
          className="rounded p-1.5 text-[#96989d] hover:text-[#dcddde] transition-colors"
          title="User Settings"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <button
          onClick={logout}
          className="rounded p-1.5 text-[#96989d] hover:text-[#dcddde] transition-colors"
          title="Log Out"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

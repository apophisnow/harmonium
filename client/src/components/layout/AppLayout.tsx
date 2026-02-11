import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Channel, ClientEvent } from '@harmonium/shared';
import { useServerStore } from '../../stores/server.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useInfiniteMessages } from '../../hooks/useInfiniteMessages.js';
import { useTypingIndicator } from '../../hooks/useTypingIndicator.js';
import { useVoice } from '../../hooks/useVoice.js';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { ServerSidebar } from './ServerSidebar.js';
import { ChannelSidebar } from './ChannelSidebar.js';
import { MemberSidebar } from './MemberSidebar.js';
import { ChannelHeader } from '../channel/ChannelHeader.js';
import { MessageList } from '../chat/MessageList.js';
import { MessageInput } from '../chat/MessageInput.js';
import { TypingIndicator } from '../chat/TypingIndicator.js';
import { CreateServerModal } from '../server/CreateServerModal.js';
import { CreateChannelModal } from '../channel/CreateChannelModal.js';
import { InviteModal } from '../server/InviteModal.js';
import { ServerSettings } from '../server/ServerSettings.js';
import { EditProfileModal } from '../user/EditProfileModal.js';
import { ScreenShareViewer } from '../voice/ScreenShareViewer.js';

const EMPTY_CHANNELS: Channel[] = [];

interface AppLayoutProps {
  sendEvent: (event: ClientEvent) => void;
  isConnected: boolean;
}

export function AppLayout({ sendEvent, isConnected }: AppLayoutProps) {
  const { serverId, channelId } = useParams<{
    serverId: string;
    channelId?: string;
  }>();
  const navigate = useNavigate();

  const fetchServers = useServerStore((s) => s.fetchServers);
  const setCurrentServer = useServerStore((s) => s.setCurrentServer);
  const currentServerId = useServerStore((s) => s.currentServerId);

  const channels = useChannelStore((s) =>
    currentServerId ? (s.channels.get(currentServerId) ?? EMPTY_CHANNELS) : EMPTY_CHANNELS,
  );
  const currentChannelId = useChannelStore((s) => s.currentChannelId);
  const setCurrentChannel = useChannelStore((s) => s.setCurrentChannel);

  const showMemberSidebar = useUIStore((s) => s.showMemberSidebar);
  const showMobileSidebar = useUIStore((s) => s.showMobileSidebar);
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar);
  const openModal = useUIStore((s) => s.openModal);

  const isMobile = useIsMobile();

  const { messages, isLoading, hasMore, loadMore } =
    useInfiniteMessages(currentChannelId);
  const { typingUsers, sendTyping } = useTypingIndicator(
    currentChannelId,
    sendEvent,
  );

  const {
    join: joinVoice,
    leave: leaveVoice,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
  } = useVoice();

  // Find the current channel object
  const currentChannel = useMemo(
    () => channels.find((c) => c.id === currentChannelId) ?? null,
    [channels, currentChannelId],
  );

  // Fetch servers on mount
  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Sync URL params to store
  useEffect(() => {
    if (serverId && serverId !== '@me') {
      setCurrentServer(serverId);
    } else {
      setCurrentServer(null);
    }
  }, [serverId, setCurrentServer]);

  useEffect(() => {
    if (channelId) {
      setCurrentChannel(channelId);
    } else if (currentServerId && channels.length > 0) {
      // Auto-select first text channel
      const firstTextChannel = channels.find((c) => c.type === 'text');
      if (firstTextChannel) {
        setCurrentChannel(firstTextChannel.id);
        navigate(
          `/channels/${currentServerId}/${firstTextChannel.id}`,
          { replace: true },
        );
      }
    }
  }, [channelId, currentServerId, channels, setCurrentChannel, navigate]);

  // Subscribe to server events via WebSocket
  useEffect(() => {
    if (currentServerId) {
      sendEvent({
        op: 'SUBSCRIBE_SERVER',
        d: { serverId: currentServerId },
      });
      return () => {
        sendEvent({
          op: 'UNSUBSCRIBE_SERVER',
          d: { serverId: currentServerId },
        });
      };
    }
  }, [currentServerId, sendEvent]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {!isConnected && (
        <div className="flex items-center justify-center bg-[#faa61a] px-4 py-1 text-sm font-medium text-white">
          Connecting to server...
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isMobile && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
              showMobileSidebar ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={closeMobileSidebar}
          />
          {/* Slide-in panel */}
          <div
            className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-300 ${
              showMobileSidebar ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <ServerSidebar />
            <ChannelSidebar
              onJoinVoice={joinVoice}
              onLeaveVoice={leaveVoice}
              onToggleMute={toggleMute}
              onToggleDeafen={toggleDeafen}
              onStartScreenShare={startScreenShare}
              onStopScreenShare={stopScreenShare}
            />
          </div>
        </>
      )}

      {/* Desktop sidebars (hidden on mobile) */}
      {!isMobile && (
        <>
          {/* Server sidebar - 72px */}
          <ServerSidebar />

          {/* Channel sidebar - 240px */}
          <ChannelSidebar
            onJoinVoice={joinVoice}
            onLeaveVoice={leaveVoice}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onStartScreenShare={startScreenShare}
            onStopScreenShare={stopScreenShare}
          />
        </>
      )}

      {/* Main chat area - flexible */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#36393f]">
        <ChannelHeader channel={currentChannel} />

        {currentChannel ? (
          <>
            <ScreenShareViewer />
            {/* Chat area with typing indicator overlay */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <MessageList
                messages={messages}
                isLoading={isLoading}
                hasMore={hasMore}
                loadMore={loadMore}
              />
              <TypingIndicator typingUsers={typingUsers} />
            </div>

            <MessageInput
              channelId={currentChannel.id}
              channelName={currentChannel.name}
              onTyping={sendTyping}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="text-[#96989d]">
              {currentServerId
                ? 'Select a channel to start chatting'
                : 'Select a server to get started'}
            </p>
            {currentServerId && (
              <button
                onClick={() => openModal('invite')}
                className="mt-4 rounded bg-[#5865f2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752c4] transition-colors"
              >
                Invite Friends
              </button>
            )}
          </div>
        )}
      </div>

      {/* Member sidebar - 240px (toggleable, hidden on mobile) */}
      {showMemberSidebar && currentServerId && !isMobile && <MemberSidebar />}

      {/* Modals */}
      <CreateServerModal />
      <CreateChannelModal />
      <InviteModal />
      <ServerSettings />
      <EditProfileModal />
      </div>
    </div>
  );
}

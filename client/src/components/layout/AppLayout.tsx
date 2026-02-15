import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Channel, ClientEvent } from '@harmonium/shared';
import { useServerStore } from '../../stores/server.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useThemeStore } from '../../stores/theme.store.js';
import { useVoiceStore } from '../../stores/voice.store.js';
import { useDMStore } from '../../stores/dm.store.js';
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
import { UserSettingsLayout } from '../user/settings/UserSettingsLayout.js';
import { ScreenShareViewer } from '../voice/ScreenShareViewer.js';
import { VoiceGrid } from '../voice/VoiceGrid.js';
import { VoicePiP } from '../voice/VoicePiP.js';
import { DMSidebar } from '../dm/DMSidebar.js';
import { DMConversation } from '../dm/DMConversation.js';
import { NewDMModal } from '../dm/NewDMModal.js';

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

  const voiceChannelId = useVoiceStore((s) => s.currentChannelId);
  const voiceIsConnected = useVoiceStore((s) => s.isConnected);
  const voiceIsConnecting = useVoiceStore((s) => s.isConnecting);

  const dmChannels = useDMStore((s) => s.channels);
  const setCurrentDMChannel = useDMStore((s) => s.setCurrentDMChannel);
  const currentDMChannelId = useDMStore((s) => s.currentDMChannelId);

  const isMobile = useIsMobile();
  const isDMView = serverId === '@me';

  // Find the current channel object
  const currentChannel = useMemo(
    () => channels.find((c) => c.id === currentChannelId) ?? null,
    [channels, currentChannelId],
  );

  // Determine view mode from existing state
  const isViewingVoiceChannel =
    currentChannel?.type === 'voice' &&
    currentChannel.id === voiceChannelId &&
    (voiceIsConnected || voiceIsConnecting);

  const showVoicePiP = voiceIsConnected && !isViewingVoiceChannel;

  // Only fetch messages/typing for text channels
  const textChannelId = currentChannel?.type !== 'voice' ? currentChannelId : null;

  const { messages, isLoading, hasMore, loadMore } =
    useInfiniteMessages(textChannelId);
  const { typingUsers, sendTyping } = useTypingIndicator(
    textChannelId,
    sendEvent,
  );

  const {
    join: joinVoice,
    leave: leaveVoice,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
    startWebcam,
    stopWebcam,
    isWebcamOn,
  } = useVoice();

  const servers = useServerStore((s) => s.servers);
  const setServerDefault = useThemeStore((s) => s.setServerDefault);

  // Fetch servers on mount
  useEffect(() => {
    fetchServers();
  }, [fetchServers]);


  // Apply server theme default when current server changes
  useEffect(() => {
    if (currentServerId) {
      const server = servers.get(currentServerId);
      if (server?.defaultTheme || server?.defaultMode) {
        setServerDefault({
          theme: server.defaultTheme ?? '',
          mode: server.defaultMode ?? '',
        });
      } else {
        setServerDefault(null);
      }
    } else {
      setServerDefault(null);
    }
  }, [currentServerId, servers, setServerDefault]);

  // Sync URL params to store
  useEffect(() => {
    if (serverId && serverId !== '@me') {
      setCurrentServer(serverId);
    } else {
      setCurrentServer(null);
    }
  }, [serverId, setCurrentServer]);

  // Sync DM channel from URL
  useEffect(() => {
    if (isDMView && channelId) {
      setCurrentDMChannel(channelId);
    } else if (isDMView) {
      setCurrentDMChannel(null);
    }
  }, [isDMView, channelId, setCurrentDMChannel]);

  // Find the current DM channel object
  const currentDMChannel = useMemo(
    () => isDMView && channelId ? dmChannels.find((c) => c.id === channelId) ?? null : null,
    [isDMView, channelId, dmChannels],
  );

  useEffect(() => {
    if (channelId && !isDMView) {
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

  // When disconnected from voice while viewing a voice channel, redirect to a text channel
  useEffect(() => {
    if (currentChannel?.type === 'voice' && !voiceIsConnected && !voiceIsConnecting) {
      const firstText = channels.find((c) => c.type === 'text');
      if (firstText) {
        setCurrentChannel(firstText.id);
        navigate(`/channels/${currentServerId}/${firstText.id}`, { replace: true });
      }
    }
  }, [currentChannel, voiceIsConnected, voiceIsConnecting, channels, currentServerId, setCurrentChannel, navigate]);

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
        <div className="flex items-center justify-center bg-th-yellow px-4 py-1 text-sm font-medium text-black">
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
            {isDMView ? (
              <DMSidebar />
            ) : (
              <ChannelSidebar
                onJoinVoice={joinVoice}
                onLeaveVoice={leaveVoice}
                onToggleMute={toggleMute}
                onToggleDeafen={toggleDeafen}
                onStartScreenShare={startScreenShare}
                onStopScreenShare={stopScreenShare}
                onStartWebcam={startWebcam}
                onStopWebcam={stopWebcam}
                isWebcamOn={isWebcamOn}
              />
            )}
          </div>
        </>
      )}

      {/* Desktop sidebars (hidden on mobile) */}
      {!isMobile && (
        <>
          {/* Server sidebar - 72px */}
          <ServerSidebar />

          {/* Channel/DM sidebar - 240px */}
          {isDMView ? (
            <DMSidebar />
          ) : (
            <ChannelSidebar
              onJoinVoice={joinVoice}
              onLeaveVoice={leaveVoice}
              onToggleMute={toggleMute}
              onToggleDeafen={toggleDeafen}
              onStartScreenShare={startScreenShare}
              onStopScreenShare={stopScreenShare}
              onStartWebcam={startWebcam}
              onStopWebcam={stopWebcam}
              isWebcamOn={isWebcamOn}
            />
          )}
        </>
      )}

      {/* Main content area */}
      {isDMView ? (
        // DM view
        currentDMChannel ? (
          <DMConversation
            dmChannelId={currentDMChannel.id}
            channel={currentDMChannel}
            sendEvent={sendEvent}
          />
        ) : (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-th-bg-primary">
            <p className="text-th-text-secondary">
              Select a conversation or start a new one
            </p>
          </div>
        )
      ) : (
        <div className="flex min-w-0 flex-1 flex-col bg-th-bg-primary">
          <ChannelHeader channel={currentChannel} />

          {isViewingVoiceChannel ? (
            // Voice channel full view
            <>
              <ScreenShareViewer />
              <VoiceGrid expanded />
            </>
          ) : currentChannel ? (
            // Text channel view (with PiP overlay if in voice)
            <>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  hasMore={hasMore}
                  loadMore={loadMore}
                />
                <TypingIndicator typingUsers={typingUsers} />
                {showVoicePiP && <VoicePiP />}
              </div>

              <MessageInput
                channelId={currentChannel.id}
                channelName={currentChannel.name}
                onTyping={sendTyping}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="text-th-text-secondary">
                {currentServerId
                  ? 'Select a channel to start chatting'
                  : 'Select a server to get started'}
              </p>
              {currentServerId && (
                <button
                  onClick={() => openModal('invite')}
                  className="mt-4 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white hover:bg-th-brand-hover transition-colors"
                >
                  Invite Friends
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Member sidebar - 240px (toggleable, hidden on mobile) */}
      {showMemberSidebar && currentServerId && !isMobile && <MemberSidebar />}

      {/* Modals */}
      <CreateServerModal />
      <CreateChannelModal />
      <InviteModal />
      <ServerSettings />
      <EditProfileModal />
      <UserSettingsLayout />
      <NewDMModal />
      </div>
    </div>
  );
}

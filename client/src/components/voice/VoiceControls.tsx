import type { Channel } from '@harmonium/shared';
import { useVoiceStore } from '../../stores/voice.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { useUIStore } from '../../stores/ui.store.js';

const EMPTY_CHANNELS: Channel[] = [];

interface VoiceControlsProps {
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onStartWebcam: () => void;
  onStopWebcam: () => void;
  isWebcamOn: boolean;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
}

export function VoiceControls({
  onLeave,
  onToggleMute,
  onToggleDeafen,
  onStartWebcam,
  onStopWebcam,
  isWebcamOn,
  onStartScreenShare,
  onStopScreenShare,
}: VoiceControlsProps) {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const currentServerId = useVoiceStore((s) => s.currentServerId);
  const isConnected = useVoiceStore((s) => s.isConnected);
  const isConnecting = useVoiceStore((s) => s.isConnecting);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isDeafened = useVoiceStore((s) => s.isDeafened);
  const isScreenSharing = useVoiceStore((s) => s.isScreenSharing);
  const screenShareUserId = useVoiceStore((s) => s.screenShareUserId);

  const channels = useChannelStore((s) =>
    currentServerId ? (s.channels.get(currentServerId) ?? EMPTY_CHANNELS) : EMPTY_CHANNELS,
  );

  if (!currentChannelId) return null;

  const channelName =
    channels.find((c) => c.id === currentChannelId)?.name ?? 'Voice Channel';

  return (
    <div className="border-t border-th-border bg-th-bg-card px-2 py-2">
      {/* Connection info */}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold ${
              isConnected
                ? 'text-th-green'
                : isConnecting
                  ? 'text-th-yellow'
                  : 'text-th-red'
            }`}
          >
            {isConnected
              ? 'Voice Connected'
              : isConnecting
                ? 'Connecting...'
                : 'Disconnected'}
          </p>
          <p className="truncate text-xs text-th-text-secondary">{channelName}</p>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {/* Mute button */}
        <button
          onClick={onToggleMute}
          className={`flex-1 flex items-center justify-center rounded p-1.5 transition-colors ${
            isMuted
              ? 'bg-th-red/20 text-th-red hover:bg-th-red/30'
              : 'text-th-text-tertiary hover:bg-th-bg-primary hover:text-th-text-primary'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm7 9a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-2.07A7 7 0 0 0 19 11z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm7 9a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-2.07A7 7 0 0 0 19 11z" />
            </svg>
          )}
        </button>

        {/* Deafen button */}
        <button
          onClick={onToggleDeafen}
          className={`flex-1 flex items-center justify-center rounded p-1.5 transition-colors ${
            isDeafened
              ? 'bg-th-red/20 text-th-red hover:bg-th-red/30'
              : 'text-th-text-tertiary hover:bg-th-bg-primary hover:text-th-text-primary'
          }`}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          {isDeafened ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.27 2L2 3.27l3.18 3.18A7.93 7.93 0 0 0 4 10v2a2 2 0 0 0 2 2h2v4a2 2 0 0 0 2 2h2v-4H8v-4H6v-2c0-1.48.44-2.86 1.18-4.03L3.27 2z" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M20 12v-2a8 8 0 0 0-14.28-4.98l1.42 1.42A6 6 0 0 1 18 10v2h2z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 12v-2a8 8 0 0 0-16 0v2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v-6a6 6 0 0 1 12 0v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM8 20v-4H6v4a2 2 0 0 0 2 2h2v-2H8zM16 20h-2v2h2a2 2 0 0 0 2-2v-4h-2v4z" />
            </svg>
          )}
        </button>

        {/* Webcam button */}
        <button
          onClick={isWebcamOn ? onStopWebcam : onStartWebcam}
          disabled={!isConnected}
          className={`flex-1 flex items-center justify-center rounded p-1.5 transition-colors ${
            isWebcamOn
              ? 'bg-th-green/20 text-th-green hover:bg-th-green/30'
              : !isConnected
                ? 'text-th-disabled cursor-not-allowed'
                : 'text-th-text-tertiary hover:bg-th-bg-primary hover:text-th-text-primary'
          }`}
          title={isWebcamOn ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        </button>

        {/* Screen Share button */}
        <button
          onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
          disabled={!isConnected || (!isScreenSharing && screenShareUserId !== null)}
          className={`flex-1 flex items-center justify-center rounded p-1.5 transition-colors ${
            isScreenSharing
              ? 'bg-th-green/20 text-th-green hover:bg-th-green/30'
              : !isConnected || screenShareUserId !== null
                ? 'text-th-disabled cursor-not-allowed'
                : 'text-th-text-tertiary hover:bg-th-bg-primary hover:text-th-text-primary'
          }`}
          title={
            isScreenSharing
              ? 'Stop Sharing'
              : screenShareUserId
                ? 'Someone is already sharing'
                : 'Share Your Screen'
          }
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 4v13h6v3h8v-3h6V4H2zm18 11H4V6h16v9z" />
          </svg>
        </button>

        {/* Voice Settings button */}
        <button
          onClick={() => useUIStore.getState().openModal('userSettings', { settingsTab: 'voice' })}
          className="flex-1 flex items-center justify-center rounded p-1.5 text-th-text-tertiary transition-colors hover:bg-th-bg-primary hover:text-th-text-primary"
          title="Voice Settings"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
          </svg>
        </button>

        {/* Disconnect button */}
        <button
          onClick={onLeave}
          className="flex-1 flex items-center justify-center rounded bg-th-red/20 p-1.5 text-th-red transition-colors hover:bg-th-red/30"
          title="Disconnect"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

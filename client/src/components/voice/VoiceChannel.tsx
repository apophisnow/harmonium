import { useNavigate } from 'react-router-dom';
import type { Channel } from '@harmonium/shared';
import { useVoiceStore } from '../../stores/voice.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { VoiceParticipant } from './VoiceParticipant.js';

interface VoiceChannelProps {
  channel: Channel;
  serverId: string;
  onJoin: (channelId: string, serverId: string) => void;
}

export function VoiceChannel({ channel, serverId, onJoin }: VoiceChannelProps) {
  const navigate = useNavigate();
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const participants = useVoiceStore((s) => s.participants);
  const isConnecting = useVoiceStore((s) => s.isConnecting);
  const setCurrentChannel = useChannelStore((s) => s.setCurrentChannel);
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar);

  const isActive = channel.id === currentChannelId;

  // Get participants in this voice channel
  const channelParticipants = isActive
    ? Array.from(participants.values())
    : [];

  const handleClick = () => {
    // If not connected to this channel, join it
    if (!isActive && !isConnecting) {
      onJoin(channel.id, serverId);
    }
    // Always navigate to show voice full view
    setCurrentChannel(channel.id);
    navigate(`/channels/${serverId}/${channel.id}`);
    closeMobileSidebar();
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`group flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
          isActive
            ? 'bg-th-bg-accent/50 text-th-green'
            : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
        }`}
      >
        {/* Speaker icon */}
        <svg
          className={`h-5 w-5 flex-shrink-0 ${
            isActive ? 'text-th-green' : 'text-th-text-secondary'
          }`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07l-1.41-1.41a3 3 0 0 0 0-4.24l1.41-1.42zM19.07 4.93a10 10 0 0 1 0 14.14l-1.41-1.41a8 8 0 0 0 0-11.31l1.41-1.42z" />
        </svg>
        <span className="truncate">{channel.name}</span>
        {isConnecting && isActive && (
          <span className="ml-auto text-xs text-th-yellow">Connecting...</span>
        )}
      </button>

      {/* Participants list */}
      {channelParticipants.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {channelParticipants.map((participant) => (
            <VoiceParticipant
              key={participant.userId}
              participant={participant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

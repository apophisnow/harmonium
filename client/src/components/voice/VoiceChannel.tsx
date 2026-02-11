import type { Channel } from '@harmonium/shared';
import { useVoiceStore } from '../../stores/voice.store.js';
import { VoiceParticipant } from './VoiceParticipant.js';

interface VoiceChannelProps {
  channel: Channel;
  serverId: string;
  onJoin: (channelId: string, serverId: string) => void;
}

export function VoiceChannel({ channel, serverId, onJoin }: VoiceChannelProps) {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const participants = useVoiceStore((s) => s.participants);
  const isConnecting = useVoiceStore((s) => s.isConnecting);

  const isActive = channel.id === currentChannelId;

  // Get participants in this voice channel
  const channelParticipants = isActive
    ? Array.from(participants.values())
    : [];

  const handleClick = () => {
    if (!isActive && !isConnecting) {
      onJoin(channel.id, serverId);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`group flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors ${
          isActive
            ? 'bg-[#40444b]/50 text-[#3ba55c]'
            : 'text-[#96989d] hover:bg-[#36393f] hover:text-[#dcddde]'
        }`}
      >
        {/* Speaker icon */}
        <svg
          className={`h-5 w-5 flex-shrink-0 ${
            isActive ? 'text-[#3ba55c]' : 'text-[#96989d]'
          }`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07l-1.41-1.41a3 3 0 0 0 0-4.24l1.41-1.42zM19.07 4.93a10 10 0 0 1 0 14.14l-1.41-1.41a8 8 0 0 0 0-11.31l1.41-1.42z" />
        </svg>
        <span className="truncate">{channel.name}</span>
        {isConnecting && isActive && (
          <span className="ml-auto text-xs text-[#faa61a]">Connecting...</span>
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

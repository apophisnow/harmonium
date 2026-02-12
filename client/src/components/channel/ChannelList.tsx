import { useState, useCallback } from 'react';
import type { Channel } from '@harmonium/shared';
import { useChannelStore } from '../../stores/channel.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useNavigate } from 'react-router-dom';
import { VoiceChannel } from '../voice/VoiceChannel.js';

const EMPTY_CHANNELS: Channel[] = [];

interface ChannelListProps {
  serverId: string;
  onJoinVoice?: (channelId: string, serverId: string) => void;
}

export function ChannelList({ serverId, onJoinVoice }: ChannelListProps) {
  const channels = useChannelStore((s) => s.channels.get(serverId) ?? EMPTY_CHANNELS);
  const currentChannelId = useChannelStore((s) => s.currentChannelId);
  const setCurrentChannel = useChannelStore((s) => s.setCurrentChannel);
  const closeMobileSidebar = useUIStore((s) => s.closeMobileSidebar);
  const navigate = useNavigate();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => {
      try {
        const stored = localStorage.getItem('collapsedCategories');
        return new Set<string>(stored ? JSON.parse(stored) : []);
      } catch {
        return new Set<string>();
      }
    },
  );

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      localStorage.setItem(
        'collapsedCategories',
        JSON.stringify([...next]),
      );
      return next;
    });
  }, []);

  // Group channels by category (null category = ungrouped)
  const textChannels = channels
    .filter((c) => c.type === 'text')
    .sort((a, b) => a.position - b.position);
  const voiceChannels = channels
    .filter((c) => c.type === 'voice')
    .sort((a, b) => a.position - b.position);

  const handleChannelClick = (channel: Channel) => {
    setCurrentChannel(channel.id);
    navigate(`/channels/${serverId}/${channel.id}`);
    closeMobileSidebar();
  };

  const isTextCollapsed = collapsedCategories.has('text');
  const isVoiceCollapsed = collapsedCategories.has('voice');

  return (
    <div className="mt-2 px-2">
      {/* Text Channels */}
      {textChannels.length > 0 && (
        <div className="mb-1">
          <h3
            className="flex items-center px-1 py-1.5 text-xs font-semibold uppercase text-th-text-secondary hover:text-th-text-primary cursor-pointer select-none"
            onClick={() => toggleCategory('text')}
          >
            <svg
              className="mr-0.5 h-3 w-3 transition-transform duration-200"
              style={isTextCollapsed ? { transform: 'rotate(-90deg)' } : undefined}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            Text Channels
          </h3>
          {!isTextCollapsed &&
            textChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={channel.id === currentChannelId}
                onClick={() => handleChannelClick(channel)}
              />
            ))}
        </div>
      )}

      {/* Voice Channels */}
      {voiceChannels.length > 0 && (
        <div className="mb-1">
          <h3
            className="flex items-center px-1 py-1.5 text-xs font-semibold uppercase text-th-text-secondary hover:text-th-text-primary cursor-pointer select-none"
            onClick={() => toggleCategory('voice')}
          >
            <svg
              className="mr-0.5 h-3 w-3 transition-transform duration-200"
              style={isVoiceCollapsed ? { transform: 'rotate(-90deg)' } : undefined}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            Voice Channels
          </h3>
          {!isVoiceCollapsed &&
            voiceChannels.map((channel) => (
              <VoiceChannel
                key={channel.id}
                channel={channel}
                serverId={serverId}
                onJoin={onJoinVoice ?? (() => {})}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-1.5 rounded px-2 py-2 md:py-1.5 text-sm transition-colors ${
        isActive
          ? 'bg-th-bg-accent text-white'
          : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
      }`}
    >
      {channel.type === 'text' ? (
        <span className="text-lg leading-none font-light text-th-text-secondary">#</span>
      ) : (
        <svg
          className="h-5 w-5 flex-shrink-0 text-th-text-secondary"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm7 9a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-2.07A7 7 0 0 0 19 11z" />
        </svg>
      )}
      <span className="truncate">{channel.name}</span>
    </button>
  );
}

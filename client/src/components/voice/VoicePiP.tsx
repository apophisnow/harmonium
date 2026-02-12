import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVoiceStore } from '../../stores/voice.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { VoiceGrid } from './VoiceGrid.js';
import { ScreenShareViewer } from './ScreenShareViewer.js';

export function VoicePiP() {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const voiceChannelId = useVoiceStore((s) => s.currentChannelId);
  const voiceServerId = useVoiceStore((s) => s.currentServerId);
  const participants = useVoiceStore((s) => s.participants);
  const isConnected = useVoiceStore((s) => s.isConnected);
  const screenShareUserId = useVoiceStore((s) => s.screenShareUserId);

  const channels = useChannelStore((s) =>
    voiceServerId ? (s.channels.get(voiceServerId) ?? []) : [],
  );
  const setCurrentChannel = useChannelStore((s) => s.setCurrentChannel);

  // Clamp position so PiP stays within viewport
  const clampPosition = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only drag from the header area (not buttons)
      if ((e.target as HTMLElement).closest('button')) return;

      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      // If no custom position yet, initialize from current rendered position
      const currentX = position?.x ?? rect.left;
      const currentY = position?.y ?? rect.top;

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: currentX,
        origY: currentY,
      };

      // If transitioning from default position, set it explicitly
      if (!position) {
        setPosition({ x: currentX, y: currentY });
      }

      // Listen on document so we never miss the pointerup even if the
      // cursor leaves the drag handle element.
      document.addEventListener('pointermove', onDocumentPointerMove);
      document.addEventListener('pointerup', onDocumentPointerUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position, clampPosition],
  );

  const onDocumentPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newPos = clampPosition(
        dragRef.current.origX + dx,
        dragRef.current.origY + dy,
      );
      setPosition(newPos);
    },
    [clampPosition],
  );

  const onDocumentPointerUp = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener('pointermove', onDocumentPointerMove);
    document.removeEventListener('pointerup', onDocumentPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDocumentPointerMove]);

  // Clean up document listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', onDocumentPointerMove);
      document.removeEventListener('pointerup', onDocumentPointerUp);
    };
  }, [onDocumentPointerMove, onDocumentPointerUp]);

  // Keep PiP within viewport on window resize
  useEffect(() => {
    if (!position) return;
    const onResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev.x, prev.y) : null));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [position, clampPosition]);

  if (!isConnected || !voiceChannelId) return null;

  const voiceChannel = channels.find((c) => c.id === voiceChannelId);
  const channelName = voiceChannel?.name ?? 'Voice Channel';
  const participantCount = participants.size;

  const handleExpand = () => {
    setCurrentChannel(voiceChannelId);
    navigate(`/channels/${voiceServerId}/${voiceChannelId}`);
  };

  // When position is set, use fixed positioning; otherwise use absolute default
  const positionStyle: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y, bottom: 'auto', right: 'auto' }
    : {};

  if (isMinimized) {
    return (
      <div
        ref={containerRef}
        className="absolute bottom-20 right-4 z-30 flex items-center gap-2 rounded-lg border border-th-border bg-th-bg-secondary px-3 py-2 shadow-lg"
        style={positionStyle}
      >
        <div
          className="flex cursor-grab items-center gap-2 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
        >
          <div className="h-2 w-2 flex-shrink-0 rounded-full bg-th-green" />
          <span className="text-xs font-medium text-white">{channelName}</span>
          <span className="text-xs text-th-text-secondary">({participantCount})</span>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="rounded p-0.5 text-th-text-secondary transition-colors hover:text-white"
          title="Show preview"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          onClick={handleExpand}
          className="rounded p-0.5 text-th-text-secondary transition-colors hover:text-white"
          title="Open full view"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-20 right-4 z-30 w-80 overflow-hidden rounded-lg border border-th-border bg-th-bg-secondary shadow-lg"
      style={positionStyle}
    >
      {/* PiP header — drag handle */}
      <div
        className="flex cursor-grab items-center justify-between bg-th-bg-card px-3 py-1.5 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="h-2 w-2 flex-shrink-0 rounded-full bg-th-green" />
          <span className="truncate text-xs font-medium text-white">{channelName}</span>
          <span className="flex-shrink-0 text-xs text-th-text-secondary">({participantCount})</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsMinimized(true)}
            className="rounded p-1 text-th-text-secondary transition-colors hover:text-white"
            title="Minimize"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            onClick={handleExpand}
            className="rounded p-1 text-th-text-secondary transition-colors hover:text-white"
            title="Open full view"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Compact screen share */}
      {screenShareUserId && <ScreenShareViewer compact />}

      {/* Compact voice grid */}
      <VoiceGrid compact />
    </div>
  );
}

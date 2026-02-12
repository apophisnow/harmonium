import { useEffect, useRef, useState } from 'react';
import { useVoiceStore } from '../../stores/voice.store.js';

interface ScreenShareViewerProps {
  compact?: boolean;
}

export function ScreenShareViewer({ compact = false }: ScreenShareViewerProps) {
  const screenShareUserId = useVoiceStore((s) => s.screenShareUserId);
  const isLocalSharing = useVoiceStore((s) => s.isScreenSharing);
  const participants = useVoiceStore((s) => s.participants);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const sharer = screenShareUserId ? participants.get(screenShareUserId) : null;

  useEffect(() => {
    const handleStream = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        userId: string;
        stream: MediaStream;
      };
      setStream(detail.stream);
    };

    const handleEnded = () => {
      setStream(null);
    };

    window.addEventListener('voice:screen_share_stream', handleStream);
    window.addEventListener('voice:screen_share_ended', handleEnded);
    return () => {
      window.removeEventListener('voice:screen_share_stream', handleStream);
      window.removeEventListener('voice:screen_share_ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  // Don't show if nobody is sharing, or if the local user is the one sharing
  if (!screenShareUserId || !sharer || isLocalSharing) return null;

  const maxHeight = compact ? '120px' : '50vh';

  return (
    <div className="flex flex-col border-b border-th-border">
      {!compact && (
        <div className="flex items-center gap-2 bg-th-bg-secondary px-3 py-1.5">
          <svg className="h-4 w-4 text-th-green" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 4v13h6v3h8v-3h6V4H2zm18 11H4V6h16v9z" />
          </svg>
          <span className="text-sm font-medium text-white">
            {sharer.username} is sharing their screen
          </span>
        </div>
      )}
      <div className="flex items-center justify-center bg-black" style={{ maxHeight }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full object-contain`}
          style={{ maxHeight }}
        />
      </div>
    </div>
  );
}

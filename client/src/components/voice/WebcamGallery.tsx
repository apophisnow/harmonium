import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voice.store.js';

export function WebcamGallery() {
  const webcamStreams = useVoiceStore((s) => s.webcamStreams);
  const participants = useVoiceStore((s) => s.participants);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const setVideoRef = useCallback(
    (userId: string, el: HTMLVideoElement | null) => {
      if (el) {
        videoRefs.current.set(userId, el);
        const stream = webcamStreams.get(userId);
        if (stream) {
          el.srcObject = stream;
        }
      } else {
        const existing = videoRefs.current.get(userId);
        if (existing) {
          existing.srcObject = null;
        }
        videoRefs.current.delete(userId);
      }
    },
    [webcamStreams],
  );

  // Listen for new webcam streams and ended streams to update video srcObjects
  useEffect(() => {
    const handleStream = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        userId: string;
        stream: MediaStream;
      };
      const video = videoRefs.current.get(detail.userId);
      if (video) {
        video.srcObject = detail.stream;
      }
    };

    const handleEnded = (event: Event) => {
      const detail = (event as CustomEvent).detail as { userId: string };
      const video = videoRefs.current.get(detail.userId);
      if (video) {
        video.srcObject = null;
      }
    };

    window.addEventListener('voice:webcam_stream', handleStream);
    window.addEventListener('voice:webcam_stream_ended', handleEnded);
    return () => {
      window.removeEventListener('voice:webcam_stream', handleStream);
      window.removeEventListener('voice:webcam_stream_ended', handleEnded);
    };
  }, []);

  // Clean up video srcObjects on unmount
  useEffect(() => {
    return () => {
      for (const video of videoRefs.current.values()) {
        video.srcObject = null;
      }
      videoRefs.current.clear();
    };
  }, []);

  const entries = Array.from(webcamStreams.entries());

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col border-b border-[#202225]">
      <div className="flex items-center gap-2 bg-[#2f3136] px-3 py-1.5">
        <svg className="h-4 w-4 text-[#3ba55c]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
        </svg>
        <span className="text-sm font-medium text-white">
          {entries.length === 1 ? '1 Webcam' : `${entries.length} Webcams`}
        </span>
      </div>
      <div
        className={`grid gap-2 p-2 ${
          entries.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
        }`}
      >
        {entries.map(([userId]) => {
          const participant = participants.get(userId);
          return (
            <div
              key={userId}
              className="relative overflow-hidden rounded-lg bg-[#2f3136] aspect-video"
            >
              <video
                ref={(el) => setVideoRef(userId, el)}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                <span className="text-xs font-medium text-white truncate">
                  {participant?.username ?? 'Unknown'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

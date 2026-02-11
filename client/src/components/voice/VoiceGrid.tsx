import { useEffect, useRef, useCallback } from 'react';
import { useVoiceStore } from '../../stores/voice.store.js';

export function VoiceGrid() {
  const isConnected = useVoiceStore((s) => s.isConnected);
  const participants = useVoiceStore((s) => s.participants);
  const webcamStreams = useVoiceStore((s) => s.webcamStreams);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Stable ref callbacks per userId — React won't re-invoke a stable ref,
  // so we avoid the hundreds-per-second play()/srcObject resets that were
  // caused by the inline arrow creating a new function every render.
  const refCallbacksRef = useRef<Map<string, (el: HTMLVideoElement | null) => void>>(new Map());

  const getRefCallback = useCallback((userId: string) => {
    let cb = refCallbacksRef.current.get(userId);
    if (!cb) {
      cb = (el: HTMLVideoElement | null) => {
        if (el) {
          videoRefs.current.set(userId, el);
          const stream = useVoiceStore.getState().webcamStreams.get(userId);
          if (stream && el.srcObject !== stream) {
            el.srcObject = stream;
            el.play().catch(() => {});
          }
        } else {
          videoRefs.current.delete(userId);
        }
      };
      refCallbacksRef.current.set(userId, cb);
    }
    return cb;
  }, []);

  // Sync srcObject whenever webcamStreams changes (handles new remote streams
  // arriving after the video element was already mounted).
  useEffect(() => {
    for (const [userId, video] of videoRefs.current) {
      const stream = webcamStreams.get(userId);
      if (stream) {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
      } else {
        video.srcObject = null;
      }
    }
  }, [webcamStreams]);

  // Listen for webcam stream events to update video srcObjects (backup for
  // race conditions where the store update and render haven't synced yet).
  useEffect(() => {
    const handleStream = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        userId: string;
        stream: MediaStream;
      };
      const video = videoRefs.current.get(detail.userId);
      if (video && video.srcObject !== detail.stream) {
        video.srcObject = detail.stream;
        video.play().catch(() => {});
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      for (const video of videoRefs.current.values()) {
        video.srcObject = null;
      }
      videoRefs.current.clear();
      refCallbacksRef.current.clear();
    };
  }, []);

  if (!isConnected) return null;

  const participantList = Array.from(participants.values());
  if (participantList.length === 0) return null;

  const gridCols =
    participantList.length === 1
      ? 'grid-cols-1'
      : participantList.length <= 4
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <div className="flex flex-col border-b border-[#202225]">
      <div className={`grid ${gridCols} gap-1.5 bg-[#2f3136] p-1.5`}>
        {participantList.map((participant) => {
          const hasStream = webcamStreams.has(participant.userId);

          return (
            <div
              key={participant.userId}
              className={`relative overflow-hidden rounded-lg bg-[#202225] aspect-video transition-shadow ${
                participant.isSpeaking
                  ? 'ring-2 ring-[#3ba55c]'
                  : 'ring-1 ring-[#2f3136]'
              }`}
            >
              {hasStream ? (
                <video
                  ref={getRefCallback(participant.userId)}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {participant.avatarUrl ? (
                    <img
                      src={participant.avatarUrl}
                      alt={participant.username}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5865f2] text-2xl font-semibold text-white">
                      {participant.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              )}

              {/* Username overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-0.5">
                <div className="flex items-center gap-1">
                  <span className="truncate text-xs font-medium text-white">
                    {participant.username}
                  </span>
                  <div className="ml-auto flex items-center gap-0.5">
                    {participant.isMuted && (
                      <svg
                        className="h-3 w-3 text-[#ed4245]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm7 9a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-2.07A7 7 0 0 0 19 11z" />
                        <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                    {participant.isDeafened && (
                      <svg
                        className="h-3 w-3 text-[#ed4245]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M3.27 2L2 3.27l3.18 3.18A7.93 7.93 0 0 0 4 10v2a2 2 0 0 0 2 2h2v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.18l4.73 4.73L20 20.73 3.27 2zM20 10v2h-2v-2a6 6 0 0 0-8.44-5.48l1.73 1.73A4 4 0 0 1 16 10v2h-2v-2a2 2 0 0 0-2-2c-.18 0-.35.03-.52.07l-1.73-1.73A4 4 0 0 1 12 6a4 4 0 0 1 4 4v2h4z" />
                      </svg>
                    )}
                    {participant.isScreenSharing && (
                      <svg
                        className="h-3 w-3 text-[#3ba55c]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M2 4v13h6v3h8v-3h6V4H2zm18 11H4V6h16v9z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

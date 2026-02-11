import type { VoiceParticipant as VoiceParticipantType } from '../../stores/voice.store.js';

interface VoiceParticipantProps {
  participant: VoiceParticipantType;
}

export function VoiceParticipant({ participant }: VoiceParticipantProps) {
  const { username, avatarUrl, isMuted, isDeafened, isSpeaking, isScreenSharing } = participant;

  return (
    <div className="flex items-center gap-1.5 rounded px-1 py-0.5 ml-6">
      {/* Avatar with speaking indicator */}
      <div
        className={`relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-all ${
          isSpeaking
            ? 'ring-2 ring-[#3ba55c]'
            : ''
        }`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#5865f2] text-[10px] font-medium text-white">
            {username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Username */}
      <span
        className={`truncate text-sm ${
          isSpeaking ? 'text-[#3ba55c]' : 'text-[#96989d]'
        }`}
      >
        {username}
      </span>

      {/* Status icons */}
      <div className="ml-auto flex items-center gap-0.5">
        {isMuted && (
          <svg
            className="h-3.5 w-3.5 text-[#ed4245]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 3a1 1 0 0 0-1 1v8a3 3 0 0 0 4.18 2.76l-8.9-8.9A1 1 0 0 0 6 6v6a6 6 0 0 0 8.44 5.48l-2.16-2.16A3 3 0 0 1 9 12v-1.17L3.71 5.54a1 1 0 0 1 1.41-1.41l15.3 15.3a1 1 0 0 1-1.41 1.41L15 16.83V12a3 3 0 0 0-3-3z" />
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
        {isDeafened && (
          <svg
            className="h-3.5 w-3.5 text-[#ed4245]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M3.27 2L2 3.27l3.18 3.18A7.93 7.93 0 0 0 4 10v2a2 2 0 0 0 2 2h2v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1.18l4.73 4.73L20 20.73 3.27 2zM20 10v2h-2v-2a6 6 0 0 0-8.44-5.48l1.73 1.73A4 4 0 0 1 16 10v2h-2v-2a2 2 0 0 0-2-2c-.18 0-.35.03-.52.07l-1.73-1.73A4 4 0 0 1 12 6a4 4 0 0 1 4 4v2h4z" />
          </svg>
        )}
        {isScreenSharing && (
          <svg
            className="h-3.5 w-3.5 text-[#3ba55c]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M2 4v13h6v3h8v-3h6V4H2zm18 11H4V6h16v9z" />
          </svg>
        )}
      </div>
    </div>
  );
}

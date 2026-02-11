import type { Server } from '@harmonium/shared';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface OverviewTabProps {
  server: Server | undefined;
  isOwner: boolean;
  displayName: string;
  hasEditedName: boolean;
  isUpdating: boolean;
  setEditName: (name: string) => void;
  setHasEditedName: (edited: boolean) => void;
  handleSaveName: () => void;
  error: string;
}

export function OverviewTab({
  server,
  isOwner,
  displayName,
  hasEditedName,
  isUpdating,
  setEditName,
  setHasEditedName,
  handleSaveName,
  error,
}: OverviewTabProps) {
  if (!server) return null;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-white">Server Overview</h2>

      <div className="flex items-start gap-6">
        {/* Server icon */}
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl bg-[#5865f2] text-3xl font-bold text-white">
          {server.iconUrl ? (
            <img src={server.iconUrl} alt={server.name} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            server.name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 space-y-4">
          {/* Server name */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#b9bbbe]">
              Server Name
            </label>
            {isOwner ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setHasEditedName(true);
                  }}
                  className="flex-1 rounded bg-[#202225] px-3 py-2 text-[#dcddde] placeholder-[#72767d] outline-none focus:ring-2 focus:ring-[#5865f2]"
                  maxLength={100}
                />
                {hasEditedName && displayName.trim() !== server.name && (
                  <button
                    onClick={handleSaveName}
                    disabled={isUpdating || !displayName.trim()}
                    className="flex items-center gap-2 rounded bg-[#5865f2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating && <LoadingSpinner size={14} />}
                    Save
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[#dcddde]">{server.name}</p>
            )}
          </div>

          {/* Server ID */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-[#b9bbbe]">
              Server ID
            </label>
            <p className="text-sm text-[#96989d] font-mono">{server.id}</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-[#ed4245]">{error}</p>}
    </div>
  );
}

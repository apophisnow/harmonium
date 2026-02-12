import { useState } from 'react';
import type { Server } from '@harmonium/shared';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';
import { themes } from '../../../themes/index.js';
import type { Mode } from '../../../themes/index.js';
import { updateServer } from '../../../api/servers.js';
import { useServerStore } from '../../../stores/server.store.js';

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
  const storeUpdateServer = useServerStore((s) => s.updateServer);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState('');

  if (!server) return null;

  const handleThemeChange = async (defaultTheme: string | null, defaultMode: string | null) => {
    setIsSavingTheme(true);
    setThemeError('');
    try {
      const updated = await updateServer(server.id, { defaultTheme, defaultMode });
      storeUpdateServer(updated);
    } catch {
      setThemeError('Failed to update default theme.');
    } finally {
      setIsSavingTheme(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-white">Server Overview</h2>

      <div className="flex items-start gap-6">
        {/* Server icon */}
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-2xl bg-th-brand text-3xl font-bold text-white">
          {server.iconUrl ? (
            <img src={server.iconUrl} alt={server.name} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            server.name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 space-y-4">
          {/* Server name */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-th-text-tertiary">
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
                  className="flex-1 rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
                  maxLength={100}
                />
                {hasEditedName && displayName.trim() !== server.name && (
                  <button
                    onClick={handleSaveName}
                    disabled={isUpdating || !displayName.trim()}
                    className="flex items-center gap-2 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating && <LoadingSpinner size={14} />}
                    Save
                  </button>
                )}
              </div>
            ) : (
              <p className="text-th-text-primary">{server.name}</p>
            )}
          </div>

          {/* Server ID */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-th-text-tertiary">
              Server ID
            </label>
            <p className="text-sm text-th-text-secondary font-mono">{server.id}</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-th-red">{error}</p>}

      {/* Default Theme section (owner only) */}
      {isOwner && (
        <div className="space-y-4 border-t border-th-border pt-6">
          <div>
            <h3 className="text-base font-semibold text-th-text-primary">Default Theme</h3>
            <p className="mt-1 text-sm text-th-text-secondary">
              Set a default theme for members who haven't chosen their own.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold uppercase text-th-text-tertiary">
                Theme
              </label>
              <select
                value={server.defaultTheme ?? ''}
                onChange={(e) => handleThemeChange(e.target.value || null, server.defaultMode)}
                disabled={isSavingTheme}
                className="w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary outline-none focus:ring-2 focus:ring-th-brand disabled:opacity-50"
              >
                <option value="">None (use host default)</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold uppercase text-th-text-tertiary">
                Mode
              </label>
              <select
                value={server.defaultMode ?? ''}
                onChange={(e) => handleThemeChange(server.defaultTheme, (e.target.value || null) as Mode | null)}
                disabled={isSavingTheme}
                className="w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary outline-none focus:ring-2 focus:ring-th-brand disabled:opacity-50"
              >
                <option value="">None (use host default)</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>

          {isSavingTheme && (
            <div className="flex items-center gap-2 text-sm text-th-text-secondary">
              <LoadingSpinner size={14} />
              Saving...
            </div>
          )}
          {themeError && <p className="text-sm text-th-red">{themeError}</p>}
        </div>
      )}
    </div>
  );
}

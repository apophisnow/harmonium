import { useThemeStore } from '../../../stores/theme.store.js';
import { themes } from '../../../themes/index.js';

export function AppearanceTab() {
  const theme = useThemeStore((s) => s.theme);
  const mode = useThemeStore((s) => s.mode);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-th-text-primary">Appearance</h2>

      {/* Theme selection */}
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-th-text-secondary">Theme</h3>
        <div className="grid grid-cols-2 gap-3">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`rounded-lg border-2 p-4 text-left transition-colors ${
                theme === t.id
                  ? 'border-th-brand bg-th-brand/10'
                  : 'border-th-border bg-th-bg-secondary hover:border-th-text-muted'
              }`}
            >
              <p className={`text-sm font-semibold ${theme === t.id ? 'text-th-brand' : 'text-th-text-primary'}`}>
                {t.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Mode selection */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase text-th-text-secondary">Mode</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('dark')}
            className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
              mode === 'dark'
                ? 'border-th-brand bg-th-brand/10'
                : 'border-th-border bg-th-bg-secondary hover:border-th-text-muted'
            }`}
          >
            <svg className={`h-5 w-5 ${mode === 'dark' ? 'text-th-brand' : 'text-th-text-secondary'}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
            </svg>
            <div>
              <p className={`text-sm font-semibold ${mode === 'dark' ? 'text-th-brand' : 'text-th-text-primary'}`}>Dark</p>
            </div>
          </button>

          <button
            onClick={() => setMode('light')}
            className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
              mode === 'light'
                ? 'border-th-brand bg-th-brand/10'
                : 'border-th-border bg-th-bg-secondary hover:border-th-text-muted'
            }`}
          >
            <svg className={`h-5 w-5 ${mode === 'light' ? 'text-th-brand' : 'text-th-text-secondary'}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
            </svg>
            <div>
              <p className={`text-sm font-semibold ${mode === 'light' ? 'text-th-brand' : 'text-th-text-primary'}`}>Light</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

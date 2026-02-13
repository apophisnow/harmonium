import { create } from 'zustand';
import { themes, DEFAULT_THEME, DEFAULT_MODE } from '../themes/index.js';
import type { Mode } from '../themes/index.js';
import { updateProfile } from '../api/users.js';

type ThemeId = (typeof themes)[number]['id'];

interface ThemeDefault {
  theme: string;
  mode: string;
}

interface ThemeState {
  theme: ThemeId;
  mode: Mode;
  hostDefault: ThemeDefault | null;
  serverDefault: ThemeDefault | null;
  hasUserPreference: boolean;

  setTheme: (theme: ThemeId) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  setHostDefault: (config: ThemeDefault) => void;
  setServerDefault: (config: ThemeDefault | null) => void;
  clearUserPreference: () => void;
  loadFromUser: (user: { theme?: string | null; mode?: string | null }) => void;
}

function applyTheme(theme: string, mode: string) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-mode', mode);
}

function isValidTheme(id: string): boolean {
  return themes.some((t) => t.id === id);
}

function isValidMode(m: string): m is Mode {
  return m === 'dark' || m === 'light';
}

/** Resolve the effective theme/mode from the cascade */
function resolve(
  hasUserPref: boolean,
  userTheme: string | null,
  userMode: string | null,
  serverDefault: ThemeDefault | null,
  hostDefault: ThemeDefault | null,
): { theme: ThemeId; mode: Mode } {
  // 1. Explicit user preference
  if (hasUserPref && userTheme && userMode) {
    const theme = isValidTheme(userTheme) ? userTheme : DEFAULT_THEME;
    const mode = isValidMode(userMode) ? userMode : DEFAULT_MODE;
    return { theme, mode };
  }

  // 2. Server default
  if (serverDefault) {
    const theme = serverDefault.theme && isValidTheme(serverDefault.theme) ? serverDefault.theme : null;
    const mode = serverDefault.mode && isValidMode(serverDefault.mode) ? serverDefault.mode : null;
    if (theme || mode) {
      return {
        theme: theme ?? hostDefault?.theme ?? DEFAULT_THEME,
        mode: (mode ?? hostDefault?.mode ?? DEFAULT_MODE) as Mode,
      };
    }
  }

  // 3. Host default
  if (hostDefault) {
    const theme = isValidTheme(hostDefault.theme) ? hostDefault.theme : DEFAULT_THEME;
    const mode = isValidMode(hostDefault.mode) ? hostDefault.mode : DEFAULT_MODE;
    return { theme, mode };
  }

  // 4. Hardcoded fallback
  return { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
}

function loadInitial(): { theme: ThemeId; mode: Mode; hasUserPreference: boolean } {
  const hasUserPreference = localStorage.getItem('app-theme-explicit') === 'true';
  const storedTheme = localStorage.getItem('app-theme');
  const storedMode = localStorage.getItem('app-mode');

  if (hasUserPreference && storedTheme && storedMode) {
    const theme = isValidTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
    const mode = isValidMode(storedMode) ? storedMode : DEFAULT_MODE;
    return { theme, mode, hasUserPreference: true };
  }

  // No user preference yet — use hardcoded fallback initially.
  // Host/server defaults will be applied asynchronously once fetched.
  return { theme: DEFAULT_THEME, mode: DEFAULT_MODE, hasUserPreference: false };
}

/** Persist theme preferences to the API (fire-and-forget) */
function persistToApi(theme: string, mode: string) {
  updateProfile({ theme, mode }).catch(() => {
    // Non-critical — localStorage is the primary cache
  });
}

const initial = loadInitial();
applyTheme(initial.theme, initial.mode);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial.theme,
  mode: initial.mode,
  hostDefault: null,
  serverDefault: null,
  hasUserPreference: initial.hasUserPreference,

  setTheme: (theme) => {
    set((state) => {
      localStorage.setItem('app-theme', theme);
      localStorage.setItem('app-mode', state.mode);
      localStorage.setItem('app-theme-explicit', 'true');
      applyTheme(theme, state.mode);
      persistToApi(theme, state.mode);
      return { theme, hasUserPreference: true };
    });
  },

  setMode: (mode) => {
    set((state) => {
      localStorage.setItem('app-theme', state.theme);
      localStorage.setItem('app-mode', mode);
      localStorage.setItem('app-theme-explicit', 'true');
      applyTheme(state.theme, mode);
      persistToApi(state.theme, mode);
      return { mode, hasUserPreference: true };
    });
  },

  toggleMode: () => {
    set((state) => {
      const newMode = state.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app-theme', state.theme);
      localStorage.setItem('app-mode', newMode);
      localStorage.setItem('app-theme-explicit', 'true');
      applyTheme(state.theme, newMode);
      persistToApi(state.theme, newMode);
      return { mode: newMode, hasUserPreference: true };
    });
  },

  setHostDefault: (config) => {
    const state = get();
    set({ hostDefault: config });
    if (!state.hasUserPreference) {
      const resolved = resolve(false, null, null, state.serverDefault, config);
      applyTheme(resolved.theme, resolved.mode);
      set({ theme: resolved.theme, mode: resolved.mode });
    }
  },

  setServerDefault: (config) => {
    const state = get();
    set({ serverDefault: config });
    if (!state.hasUserPreference) {
      const resolved = resolve(false, null, null, config, state.hostDefault);
      applyTheme(resolved.theme, resolved.mode);
      set({ theme: resolved.theme, mode: resolved.mode });
    }
  },

  clearUserPreference: () => {
    localStorage.removeItem('app-theme');
    localStorage.removeItem('app-mode');
    localStorage.removeItem('app-theme-explicit');
    persistToApi('', '');
    const state = get();
    const resolved = resolve(false, null, null, state.serverDefault, state.hostDefault);
    applyTheme(resolved.theme, resolved.mode);
    set({ theme: resolved.theme, mode: resolved.mode, hasUserPreference: false });
  },

  loadFromUser: (user) => {
    if (user.theme && user.mode) {
      const theme = isValidTheme(user.theme) ? user.theme : DEFAULT_THEME;
      const mode = isValidMode(user.mode) ? user.mode : DEFAULT_MODE;
      localStorage.setItem('app-theme', theme);
      localStorage.setItem('app-mode', mode);
      localStorage.setItem('app-theme-explicit', 'true');
      applyTheme(theme, mode);
      set({ theme, mode, hasUserPreference: true });
    }
  },
}));

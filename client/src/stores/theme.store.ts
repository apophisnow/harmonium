import { create } from 'zustand';
import { themes, DEFAULT_THEME, DEFAULT_MODE } from '../themes/index.js';
import type { Mode } from '../themes/index.js';

type ThemeId = (typeof themes)[number]['id'];

interface ThemeState {
  theme: ThemeId;
  mode: Mode;
  setTheme: (theme: ThemeId) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

function applyTheme(theme: string, mode: string) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-mode', mode);
}

function loadFromStorage(): { theme: ThemeId; mode: Mode } {
  const storedTheme = localStorage.getItem('app-theme') ?? DEFAULT_THEME;
  const storedMode = (localStorage.getItem('app-mode') ?? DEFAULT_MODE) as Mode;
  const validTheme = themes.find((t) => t.id === storedTheme) ? storedTheme : DEFAULT_THEME;
  return { theme: validTheme, mode: storedMode };
}

const initial = loadFromStorage();
applyTheme(initial.theme, initial.mode);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial.theme,
  mode: initial.mode,

  setTheme: (theme) => {
    localStorage.setItem('app-theme', theme);
    set((state) => {
      applyTheme(theme, state.mode);
      return { theme };
    });
  },

  setMode: (mode) => {
    localStorage.setItem('app-mode', mode);
    set((state) => {
      applyTheme(state.theme, mode);
      return { mode };
    });
  },

  toggleMode: () => {
    set((state) => {
      const newMode = state.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app-mode', newMode);
      applyTheme(state.theme, newMode);
      return { mode: newMode };
    });
  },
}));

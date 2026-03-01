import { create } from 'zustand';

const STORAGE_KEY = 'audio-settings';

export interface AudioSettings {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  videoDeviceId: string | null;
  inputVolume: number;
  outputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  voiceActivityThreshold: number;
}

const DEFAULTS: AudioSettings = {
  inputDeviceId: null,
  outputDeviceId: null,
  videoDeviceId: null,
  inputVolume: 100,
  outputVolume: 100,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceActivityThreshold: -50,
};

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings: AudioSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage quota exceeded — continue with in-memory state
  }
}

interface AudioSettingsState extends AudioSettings {
  update: (partial: Partial<AudioSettings>) => void;
  reset: () => void;
}

const initial = loadSettings();

export const useAudioSettingsStore = create<AudioSettingsState>((set) => ({
  ...initial,

  update: (partial) =>
    set((state) => {
      const { update: _u, reset: _r, ...current } = state;
      const next = { ...current, ...partial };
      saveSettings(next);
      return partial;
    }),

  reset: () => {
    saveSettings(DEFAULTS);
    set(DEFAULTS);
  },
}));

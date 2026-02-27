# 17 — Audio Device Settings

## Summary

Allow users to select their preferred microphone, speaker, and webcam devices, adjust input/output volume, configure audio processing options (echo cancellation, noise suppression, auto gain control), and preview audio levels — all from a new "Voice & Audio" tab in user settings.

Device preferences are per-machine, so they are stored in `localStorage` rather than the database.

## Dependencies

None — the voice system already exists (`useVoice`, `voice.store`, mediasoup pipeline). This feature layers settings on top of it.

## Complexity

Medium (~10 files touched)

## Shared Types

### Modify `packages/shared/src/types/voice.ts`

Add the audio settings shape so both client and server stay in sync on constraint types:

```typescript
export interface AudioSettings {
  inputDeviceId: string | null;   // null = system default
  outputDeviceId: string | null;
  videoDeviceId: string | null;
  inputVolume: number;            // 0–100, default 100
  outputVolume: number;           // 0–100, default 100
  echoCancellation: boolean;      // default true
  noiseSuppression: boolean;      // default true
  autoGainControl: boolean;       // default true
  voiceActivityThreshold: number; // dB, default -50 (matches current SPEAKING_THRESHOLD)
}
```

## Database Changes

None. Device preferences are hardware-specific and stored client-side in `localStorage`.

## API Changes

None.

## WebSocket Changes

None.

## Frontend Changes

### Create `client/src/stores/audio-settings.store.ts`

Zustand store backed by `localStorage` key `audio-settings`.

```typescript
import { create } from 'zustand';
import type { AudioSettings } from '@harmonium/shared';

const STORAGE_KEY = 'audio-settings';

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface AudioSettingsStore extends AudioSettings {
  update: (partial: Partial<AudioSettings>) => void;
  reset: () => void;
}

export const useAudioSettingsStore = create<AudioSettingsStore>((set) => ({
  ...loadSettings(),
  update: (partial) =>
    set((state) => {
      const next = { ...state, ...partial };
      saveSettings(next);
      return next;
    }),
  reset: () => {
    saveSettings(DEFAULTS);
    set(DEFAULTS);
  },
}));
```

### Create `client/src/hooks/useMediaDevices.ts`

Hook that enumerates available devices and re-enumerates when devices change.

```typescript
import { useState, useEffect } from 'react';

export interface DeviceList {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
}

export function useMediaDevices(): DeviceList {
  const [devices, setDevices] = useState<DeviceList>({
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
  });

  useEffect(() => {
    async function enumerate() {
      // Request a transient stream to trigger permission prompt if needed,
      // so device labels are available.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied — enumerate anyway (labels will be empty).
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioInputs: all.filter((d) => d.kind === 'audioinput'),
        audioOutputs: all.filter((d) => d.kind === 'audiooutput'),
        videoInputs: all.filter((d) => d.kind === 'videoinput'),
      });
    }

    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, []);

  return devices;
}
```

### Create `client/src/hooks/useInputLevelMeter.ts`

Hook that opens a mic stream for the selected device and returns a 0–100 level for the UI meter.

```typescript
import { useEffect, useRef, useState } from 'react';

export function useInputLevelMeter(deviceId: string | null): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
        });
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Float32Array(analyser.fftSize);

        function tick() {
          if (cancelled) return;
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
          const rms = Math.sqrt(sum / data.length);
          // Convert to 0–100 percentage (clamp)
          setLevel(Math.min(100, Math.round(rms * 300)));
          rafRef.current = requestAnimationFrame(tick);
        }
        tick();
      } catch {
        // Device unavailable
      }
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
    };
  }, [deviceId]);

  return level;
}
```

### Modify `client/src/hooks/useVoice.ts`

Apply device and processing settings when producing audio:

1. **Mic constraints** — Read `inputDeviceId`, `echoCancellation`, `noiseSuppression`, and `autoGainControl` from `useAudioSettingsStore.getState()` and pass them to `getUserMedia`:

```typescript
const settings = useAudioSettingsStore.getState();
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    deviceId: settings.inputDeviceId ? { exact: settings.inputDeviceId } : undefined,
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  },
});
```

2. **Input volume** — Insert a GainNode between the mic source and the mediasoup producer track. Scale by `settings.inputVolume / 100`.

3. **Output volume** — When creating `HTMLAudioElement` instances for remote consumers, set `audio.volume = settings.outputVolume / 100`.

4. **Output device** — After creating each `HTMLAudioElement`, call `audio.setSinkId(settings.outputDeviceId)` if the browser supports it.

5. **Webcam device** — When starting the webcam, read `videoDeviceId` from settings:

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    deviceId: settings.videoDeviceId ? { exact: settings.videoDeviceId } : undefined,
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
});
```

6. **Speaking threshold** — Replace the hard-coded `SPEAKING_THRESHOLD = -50` with `useAudioSettingsStore.getState().voiceActivityThreshold`.

### Modify `client/src/components/user/settings/UserSettingsLayout.tsx`

Add a "Voice & Audio" tab to the settings sidebar, between "Appearance" and any future tabs:

```typescript
{ id: 'voice', label: 'Voice & Audio', icon: MicrophoneIcon }
```

Render `<VoiceAudioTab />` when active.

### Create `client/src/components/user/settings/VoiceAudioTab.tsx`

The settings panel, divided into sections:

```
┌──────────────────────────────────────────┐
│  Voice & Audio Settings                  │
├──────────────────────────────────────────┤
│                                          │
│  INPUT DEVICE                            │
│  ┌──────────────────────────────┐        │
│  │ Default — Built-in Mic   ▼  │        │
│  └──────────────────────────────┘        │
│  Input Volume   ━━━━━━━━━━━━●━━ 80%     │
│  Mic Level      ▓▓▓▓▓▓▓░░░░░░░          │
│                                          │
│  OUTPUT DEVICE                           │
│  ┌──────────────────────────────┐        │
│  │ Default — Speakers       ▼  │        │
│  └──────────────────────────────┘        │
│  Output Volume  ━━━━━━━━━━━━━━● 100%    │
│                                          │
│  VIDEO DEVICE                            │
│  ┌──────────────────────────────┐        │
│  │ Default — FaceTime HD    ▼  │        │
│  └──────────────────────────────┘        │
│                                          │
│  AUDIO PROCESSING                        │
│  ☑ Echo Cancellation                     │
│  ☑ Noise Suppression                     │
│  ☑ Auto Gain Control                     │
│                                          │
│  ADVANCED                                │
│  Voice Activity Threshold                │
│  ━━━━━●━━━━━━━━━ -50 dB                 │
│                                          │
│  [Reset to Defaults]                     │
│                                          │
└──────────────────────────────────────────┘
```

**Implementation details:**

- Use `useMediaDevices()` to populate the three `<select>` dropdowns.
- Use `useAudioSettingsStore()` to read and write all values.
- Use `useInputLevelMeter(inputDeviceId)` to drive the mic level bar.
- Each control calls `store.update({ key: value })` on change; changes take effect immediately for active voice sessions by re-reading from the store.
- "Reset to Defaults" button calls `store.reset()`.
- Styling follows existing Tailwind + `th-*` theme variable conventions used in `AppearanceTab` and `MyAccountTab`.

### Create `client/src/components/voice/VoiceSettingsQuickMenu.tsx`

A small popover accessible from the existing `VoiceControls` bar (gear icon next to disconnect) for quick access without opening the full settings modal:

- Input device dropdown
- Output device dropdown
- Input volume slider
- Output volume slider
- Link to "Open Voice & Audio Settings" (opens UserSettings to the voice tab)

## Applying Settings Mid-Call

When settings change while the user is already in a voice channel:

| Setting changed        | Action                                                                 |
|------------------------|------------------------------------------------------------------------|
| Input device           | Stop current mic track, re-acquire with new device, replace producer   |
| Output device          | Call `setSinkId()` on all active `HTMLAudioElement` consumers          |
| Video device           | If webcam active: stop current track, re-acquire, replace producer     |
| Input volume           | Update GainNode value                                                  |
| Output volume          | Update `.volume` on all consumer audio elements                        |
| Echo/Noise/AGC         | Stop mic track, re-acquire with new constraints, replace producer      |
| Voice activity thresh  | Update threshold variable (read on next tick)                          |

Subscribe to store changes in `useVoice` via `useAudioSettingsStore.subscribe()` and apply the appropriate action for each changed key.

## Edge Cases

- **Device disconnected mid-call**: The `devicechange` event fires → re-enumerate → if the active device is gone, fall back to the system default and show a toast: "Your microphone was disconnected. Switched to default device."
- **Browser doesn't support `setSinkId`**: Hide the output device selector and use the system default. Check via `'setSinkId' in HTMLAudioElement.prototype`.
- **Permission denied**: Show an inline warning in the settings tab: "Microphone access is blocked. Check your browser permissions."
- **No devices found**: Show "No devices found" in the dropdown with a disabled state.
- **Input volume at 0**: Effectively mutes the mic input at the GainNode level (distinct from the mute toggle which stops the track).
- **Output volume at 0**: Sets `audio.volume = 0` on all consumer elements (distinct from deafen which pauses consumers).
- **localStorage quota exceeded**: Catch the error in `saveSettings` and continue with in-memory state.

## Testing Notes

- Verify device enumeration populates correctly with multiple audio devices.
- Verify changing input device mid-call switches the mic seamlessly.
- Verify output device change applies to all current consumers.
- Verify volume sliders update in real-time (input via GainNode, output via element volume).
- Verify audio processing toggles take effect on next mic acquisition.
- Verify settings persist across page reloads via localStorage.
- Verify the mic level meter animates in response to actual audio input.
- Verify graceful fallback when `setSinkId` is not supported.
- Verify device hot-plug/unplug triggers re-enumeration and appropriate fallback.

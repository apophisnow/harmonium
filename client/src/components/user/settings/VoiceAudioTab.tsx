import { useAudioSettingsStore } from '../../../stores/audioSettings.store.js';
import { useMediaDevices } from '../../../hooks/useMediaDevices.js';
import { useInputLevelMeter } from '../../../hooks/useInputLevelMeter.js';

const supportsOutputDevice = 'setSinkId' in HTMLAudioElement.prototype;

export function VoiceAudioTab() {
  const settings = useAudioSettingsStore();
  const { audioInputs, audioOutputs, videoInputs } = useMediaDevices();
  const inputLevel = useInputLevelMeter(settings.inputDeviceId);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-th-text-primary">Voice & Audio</h2>

      {/* Input Device */}
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-th-text-secondary">
          Input Device
        </h3>
        <select
          value={settings.inputDeviceId ?? ''}
          onChange={(e) =>
            settings.update({ inputDeviceId: e.target.value || null })
          }
          className="mb-3 w-full rounded border border-th-border bg-th-bg-secondary px-3 py-2 text-sm text-th-text-primary outline-none focus:border-th-brand"
        >
          <option value="">Default</option>
          {audioInputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
            </option>
          ))}
        </select>

        <div className="mb-3">
          <label className="mb-1.5 flex items-center justify-between text-xs text-th-text-secondary">
            <span>Input Volume</span>
            <span>{settings.inputVolume}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.inputVolume}
            onChange={(e) =>
              settings.update({ inputVolume: Number(e.target.value) })
            }
            className="w-full accent-th-brand"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-th-text-secondary">
            Mic Test
          </label>
          <div className="h-2 overflow-hidden rounded-full bg-th-bg-secondary">
            <div
              className="h-full rounded-full bg-th-green transition-all duration-75"
              style={{ width: `${inputLevel}%` }}
            />
          </div>
        </div>
      </div>

      {/* Output Device */}
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-th-text-secondary">
          Output Device
        </h3>
        {supportsOutputDevice ? (
          <select
            value={settings.outputDeviceId ?? ''}
            onChange={(e) =>
              settings.update({ outputDeviceId: e.target.value || null })
            }
            className="mb-3 w-full rounded border border-th-border bg-th-bg-secondary px-3 py-2 text-sm text-th-text-primary outline-none focus:border-th-brand"
          >
            <option value="">Default</option>
            {audioOutputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Speaker (${d.deviceId.slice(0, 8)})`}
              </option>
            ))}
          </select>
        ) : (
          <p className="mb-3 text-xs text-th-text-muted">
            Output device selection is not supported in this browser.
          </p>
        )}

        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs text-th-text-secondary">
            <span>Output Volume</span>
            <span>{settings.outputVolume}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.outputVolume}
            onChange={(e) =>
              settings.update({ outputVolume: Number(e.target.value) })
            }
            className="w-full accent-th-brand"
          />
        </div>
      </div>

      {/* Video Device */}
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-th-text-secondary">
          Video Device
        </h3>
        <select
          value={settings.videoDeviceId ?? ''}
          onChange={(e) =>
            settings.update({ videoDeviceId: e.target.value || null })
          }
          className="w-full rounded border border-th-border bg-th-bg-secondary px-3 py-2 text-sm text-th-text-primary outline-none focus:border-th-brand"
        >
          <option value="">Default</option>
          {videoInputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera (${d.deviceId.slice(0, 8)})`}
            </option>
          ))}
        </select>
      </div>

      {/* Audio Processing */}
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-th-text-secondary">
          Audio Processing
        </h3>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 text-sm text-th-text-primary">
            <input
              type="checkbox"
              checked={settings.echoCancellation}
              onChange={(e) =>
                settings.update({ echoCancellation: e.target.checked })
              }
              className="h-4 w-4 accent-th-brand"
            />
            Echo Cancellation
          </label>
          <label className="flex items-center gap-3 text-sm text-th-text-primary">
            <input
              type="checkbox"
              checked={settings.noiseSuppression}
              onChange={(e) =>
                settings.update({ noiseSuppression: e.target.checked })
              }
              className="h-4 w-4 accent-th-brand"
            />
            Noise Suppression
          </label>
          <label className="flex items-center gap-3 text-sm text-th-text-primary">
            <input
              type="checkbox"
              checked={settings.autoGainControl}
              onChange={(e) =>
                settings.update({ autoGainControl: e.target.checked })
              }
              className="h-4 w-4 accent-th-brand"
            />
            Automatic Gain Control
          </label>
        </div>
      </div>

      {/* Advanced */}
      <div className="mb-8">
        <h3 className="mb-3 text-xs font-bold uppercase text-th-text-secondary">
          Advanced
        </h3>
        <div>
          <label className="mb-1.5 flex items-center justify-between text-xs text-th-text-secondary">
            <span>Voice Activity Threshold</span>
            <span>{settings.voiceActivityThreshold} dB</span>
          </label>
          <input
            type="range"
            min={-90}
            max={-20}
            value={settings.voiceActivityThreshold}
            onChange={(e) =>
              settings.update({
                voiceActivityThreshold: Number(e.target.value),
              })
            }
            className="w-full accent-th-brand"
          />
          <p className="mt-1 text-xs text-th-text-muted">
            Lower values make the mic more sensitive to quiet sounds.
          </p>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={settings.reset}
        className="rounded border border-th-border px-4 py-2 text-sm text-th-text-secondary transition-colors hover:bg-th-bg-secondary hover:text-th-text-primary"
      >
        Reset to Defaults
      </button>
    </div>
  );
}

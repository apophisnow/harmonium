import { useState, useEffect, useRef } from 'react';

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

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function enumerate() {
      // Request a transient stream so the browser exposes device labels
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied — enumerate anyway (labels will be empty)
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      if (!mountedRef.current) return;
      setDevices({
        audioInputs: all.filter((d) => d.kind === 'audioinput'),
        audioOutputs: all.filter((d) => d.kind === 'audiooutput'),
        videoInputs: all.filter((d) => d.kind === 'videoinput'),
      });
    }

    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => {
      mountedRef.current = false;
      navigator.mediaDevices.removeEventListener('devicechange', enumerate);
    };
  }, []);

  return devices;
}

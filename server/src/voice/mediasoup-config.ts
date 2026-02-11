import type { WorkerSettings, RouterOptions, WebRtcTransportOptions } from 'mediasoup/types';
import os from 'os';
import { getConfig } from '../config.js';

export const workerSettings: WorkerSettings = {
  rtcMinPort: 40000,
  rtcMaxPort: 40100,
  logLevel: 'warn',
  logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
};

export const mediaCodecs: RouterOptions['mediaCodecs'] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

export function getTransportOptions(): WebRtcTransportOptions {
  const config = getConfig();
  return {
    listenInfos: [
      { protocol: 'udp', ip: '0.0.0.0', announcedAddress: config.MEDIASOUP_ANNOUNCED_IP },
      { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: config.MEDIASOUP_ANNOUNCED_IP },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: !config.MEDIASOUP_PREFER_TCP,
    preferTcp: config.MEDIASOUP_PREFER_TCP,
  };
}

export const NUM_WORKERS = Math.min(os.cpus().length, 4);

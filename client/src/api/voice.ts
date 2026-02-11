import type { VoiceState } from '@harmonium/shared';
import { apiClient } from './client.js';

export interface JoinVoiceResponse {
  sendTransport: {
    id: string;
    iceParameters: unknown;
    iceCandidates: unknown;
    dtlsParameters: unknown;
  };
  recvTransport: {
    id: string;
    iceParameters: unknown;
    iceCandidates: unknown;
    dtlsParameters: unknown;
  };
  rtpCapabilities: {
    codecs?: unknown[];
    headerExtensions?: unknown[];
  };
  existingProducers: Array<{ producerId: string; userId: string; kind: 'audio' | 'video' }>;
}

export interface ConsumeResponse {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: unknown;
}

export async function joinVoice(channelId: string): Promise<JoinVoiceResponse> {
  const response = await apiClient.post<JoinVoiceResponse>('/voice/join', {
    channelId,
  });
  return response.data;
}

export async function connectTransport(data: {
  channelId: string;
  transportId: string;
  dtlsParameters: unknown;
}): Promise<void> {
  await apiClient.post('/voice/connect-transport', data);
}

export async function produce(data: {
  channelId: string;
  transportId: string;
  kind: string;
  rtpParameters: unknown;
}): Promise<{ producerId: string }> {
  const response = await apiClient.post<{ producerId: string }>(
    '/voice/produce',
    data,
  );
  return response.data;
}

export async function consume(data: {
  channelId: string;
  producerId: string;
  rtpCapabilities: unknown;
}): Promise<ConsumeResponse> {
  const response = await apiClient.post<ConsumeResponse>(
    '/voice/consume',
    data,
  );
  return response.data;
}

export async function leaveVoice(channelId: string): Promise<void> {
  await apiClient.post('/voice/leave', { channelId });
}

export async function stopScreenShare(): Promise<void> {
  await apiClient.post('/voice/stop-screen-share');
}

export async function getVoiceStates(
  serverId: string,
): Promise<(VoiceState & { username: string })[]> {
  const response = await apiClient.get<(VoiceState & { username: string })[]>(
    `/voice/state/${serverId}`,
  );
  return response.data;
}

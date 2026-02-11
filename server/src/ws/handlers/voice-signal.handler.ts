import type { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import { connectionManager } from '../index.js';
import { updateVoiceState, leaveVoice } from '../../modules/voice/voice.service.js';

/**
 * Handle VOICE_STATE_UPDATE from a client.
 * Used for mute/deaf state updates sent over the WebSocket.
 */
export async function handleVoiceStateUpdate(
  _app: FastifyInstance,
  ws: WebSocket,
  data: { channelId: string | null; selfMute: boolean; selfDeaf: boolean },
): Promise<void> {
  const meta = connectionManager.getMeta(ws);
  if (!meta) return;

  const { channelId, selfMute, selfDeaf } = data;

  // If channelId is null, the user is leaving voice
  if (channelId === null) {
    await leaveVoice(meta.userId);
    return;
  }

  // Otherwise, update mute/deaf state
  await updateVoiceState(meta.userId, selfMute ?? false, selfDeaf ?? false);
}

import type { PubSubManager } from '../pubsub.js';
import type { DMMessage } from '@harmonium/shared';

/**
 * Broadcast a DM message creation to all participants.
 */
export function broadcastDMMessageCreate(
  pubsub: PubSubManager,
  participantIds: string[],
  dmChannelId: string,
  message: DMMessage,
): void {
  for (const userId of participantIds) {
    pubsub.publishToUser(userId, {
      op: 'DM_MESSAGE_CREATE',
      d: { dmChannelId, message },
    });
  }
}

/**
 * Broadcast a DM message deletion to all participants.
 */
export function broadcastDMMessageDelete(
  pubsub: PubSubManager,
  participantIds: string[],
  dmChannelId: string,
  messageId: string,
): void {
  for (const userId of participantIds) {
    pubsub.publishToUser(userId, {
      op: 'DM_MESSAGE_DELETE',
      d: { dmChannelId, id: messageId },
    });
  }
}

/**
 * Broadcast DM typing event to the other participant(s).
 */
export function broadcastDMTypingStart(
  pubsub: PubSubManager,
  participantIds: string[],
  dmChannelId: string,
  userId: string,
  username: string,
): void {
  for (const participantId of participantIds) {
    if (participantId === userId) continue; // Don't send to self
    pubsub.publishToUser(participantId, {
      op: 'DM_TYPING_START',
      d: {
        dmChannelId,
        userId,
        username,
        timestamp: Date.now(),
      },
    });
  }
}

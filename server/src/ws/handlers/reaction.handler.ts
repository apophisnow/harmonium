import type { PubSubManager } from '../pubsub.js';

export function broadcastReactionAdd(
  pubsub: PubSubManager,
  serverId: string,
  channelId: string,
  messageId: string,
  userId: string,
  emoji: string,
): void {
  pubsub.publishToServer(serverId, {
    op: 'REACTION_ADD',
    d: { channelId, messageId, userId, emoji },
  });
}

export function broadcastReactionRemove(
  pubsub: PubSubManager,
  serverId: string,
  channelId: string,
  messageId: string,
  userId: string,
  emoji: string,
): void {
  pubsub.publishToServer(serverId, {
    op: 'REACTION_REMOVE',
    d: { channelId, messageId, userId, emoji },
  });
}

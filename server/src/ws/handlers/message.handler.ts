import type { Message } from '@harmonium/shared';
import type { PubSubManager } from '../pubsub.js';

export function broadcastMessageCreate(pubsub: PubSubManager, serverId: string, message: Message): void {
  pubsub.publishToServer(serverId, { op: 'MESSAGE_CREATE', d: { message } });
}

export function broadcastMessageUpdate(
  pubsub: PubSubManager,
  serverId: string,
  message: Partial<Message> & { id: string; channelId: string },
): void {
  pubsub.publishToServer(serverId, { op: 'MESSAGE_UPDATE', d: { message } });
}

export function broadcastMessageDelete(
  pubsub: PubSubManager,
  serverId: string,
  messageId: string,
  channelId: string,
): void {
  pubsub.publishToServer(serverId, { op: 'MESSAGE_DELETE', d: { id: messageId, channelId } });
}

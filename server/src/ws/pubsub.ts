import { Redis } from 'ioredis';
import type { ServerEvent } from '@harmonium/shared';
import { connectionManager } from './index.js';
import { getConfig } from '../config.js';

export interface PubSubEvent {
  /** The event to send to clients */
  event: ServerEvent;
  /** If set, exclude this userId from receiving the broadcast */
  excludeUserId?: string;
}

export class PubSubManager {
  private subscriber: Redis;
  private publisher: Redis;
  private subscribedChannels = new Set<string>();

  constructor(redisUrl: string) {
    // Dedicated subscriber connection (pub/sub requires dedicated connection)
    this.subscriber = new Redis(redisUrl);
    // Publisher connection (can be shared / separate)
    this.publisher = new Redis(redisUrl);

    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });
  }

  /** Publish an event to a server channel */
  async publishToServer(serverId: string, event: ServerEvent, excludeUserId?: string): Promise<void> {
    const channel = `ws:server:${serverId}`;
    const payload: PubSubEvent = { event, excludeUserId };
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  /** Publish an event to a specific user channel */
  async publishToUser(userId: string, event: ServerEvent): Promise<void> {
    const channel = `ws:user:${userId}`;
    const payload: PubSubEvent = { event };
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  /** Subscribe to a server's Redis channel for receiving broadcasts */
  async subscribeToServer(serverId: string): Promise<void> {
    const channel = `ws:server:${serverId}`;
    if (this.subscribedChannels.has(channel)) return;
    this.subscribedChannels.add(channel);
    await this.subscriber.subscribe(channel);
  }

  /** Unsubscribe from a server's Redis channel when no local users need it */
  async unsubscribeFromServer(serverId: string): Promise<void> {
    const channel = `ws:server:${serverId}`;
    if (!this.subscribedChannels.has(channel)) return;

    // Only unsubscribe if no local users are subscribed to this server
    if (connectionManager.hasLocalSubscribers(serverId)) return;

    this.subscribedChannels.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  /** Subscribe to a user's Redis channel for receiving direct events */
  async subscribeToUser(userId: string): Promise<void> {
    const channel = `ws:user:${userId}`;
    if (this.subscribedChannels.has(channel)) return;
    this.subscribedChannels.add(channel);
    await this.subscriber.subscribe(channel);
  }

  /** Unsubscribe from a user's Redis channel when they have no local connections */
  async unsubscribeFromUser(userId: string): Promise<void> {
    const channel = `ws:user:${userId}`;
    if (!this.subscribedChannels.has(channel)) return;

    // Only unsubscribe if user has no local connections
    if (connectionManager.getConnections(userId)) return;

    this.subscribedChannels.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  /** Handle incoming pub/sub message and dispatch to local connections */
  private handleMessage(channel: string, message: string): void {
    try {
      const payload = JSON.parse(message) as PubSubEvent;

      if (channel.startsWith('ws:server:')) {
        const serverId = channel.slice('ws:server:'.length);
        connectionManager.broadcastToServer(serverId, payload.event, payload.excludeUserId);
      } else if (channel.startsWith('ws:user:')) {
        const userId = channel.slice('ws:user:'.length);
        connectionManager.sendToUser(userId, payload.event);
      }
    } catch {
      // Ignore malformed messages
    }
  }

  /** Gracefully shut down both Redis connections */
  async close(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
  }
}

let pubsubInstance: PubSubManager | undefined;

/** Get or create the PubSubManager singleton */
export function getPubSubManager(): PubSubManager {
  if (!pubsubInstance) {
    const config = getConfig();
    pubsubInstance = new PubSubManager(config.REDIS_URL);
  }
  return pubsubInstance;
}

/** Export for use by other modules */
export { pubsubInstance };

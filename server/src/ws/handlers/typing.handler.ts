import type { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import type { TypingStartServerEvent } from '@harmonium/shared';
import { connectionManager } from '../index.js';
import { getPubSubManager } from '../pubsub.js';
import { getDb, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';

/**
 * Handle TYPING_START from a client.
 * Sets a Redis key with 10s TTL and broadcasts to the channel via pub/sub.
 */
export async function handleTypingStart(
  app: FastifyInstance,
  ws: WebSocket,
  data: { channelId: string },
): Promise<void> {
  const meta = connectionManager.getMeta(ws);
  if (!meta) return;

  const { channelId } = data;
  if (!channelId) return;

  const redisKey = `typing:${channelId}:${meta.userId}`;

  // Check if the key already exists (to avoid spamming broadcasts)
  const existing = await app.redis.get(redisKey);

  // Set/refresh the TTL regardless
  await app.redis.set(redisKey, '1', 'EX', 10);

  // Only broadcast if this is a new typing indicator
  if (!existing) {
    // Look up username from DB
    const db = getDb();
    const userRow = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, BigInt(meta.userId)))
      .limit(1);

    const username = userRow[0]?.username ?? 'Unknown';

    // We need to find which server this channel belongs to for pub/sub routing
    const channelRow = await db
      .select({ serverId: schema.channels.serverId })
      .from(schema.channels)
      .where(eq(schema.channels.id, BigInt(channelId)))
      .limit(1);

    if (!channelRow[0]) return;

    const serverId = channelRow[0].serverId.toString();

    const event: TypingStartServerEvent = {
      op: 'TYPING_START',
      d: {
        channelId,
        userId: meta.userId,
        username,
        timestamp: Date.now(),
      },
    };

    const pubsub = getPubSubManager();
    await pubsub.publishToServer(serverId, event, meta.userId);
  }
}

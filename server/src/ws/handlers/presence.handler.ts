import type { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import type { UserStatus, PresenceUpdateServerEvent } from '@harmonium/shared';
import { connectionManager } from '../index.js';
import { getPubSubManager } from '../pubsub.js';
import { getDb, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';

const PRESENCE_TTL = 120; // seconds

/**
 * Set the user's presence in Redis and update the DB.
 */
async function setPresence(
  app: FastifyInstance,
  userId: string,
  status: UserStatus,
): Promise<void> {
  const redisKey = `presence:${userId}`;

  if (status === 'offline') {
    await app.redis.del(redisKey);
  } else {
    await app.redis.set(redisKey, status, 'EX', PRESENCE_TTL);
  }

  // Update status in the database
  const db = getDb();
  await db
    .update(schema.users)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.users.id, BigInt(userId)));
}

/**
 * Broadcast a presence update to all servers the user belongs to.
 */
async function broadcastPresence(
  userId: string,
  status: UserStatus,
): Promise<void> {
  const db = getDb();

  // Find all servers the user is a member of
  const memberships = await db
    .select({ serverId: schema.serverMembers.serverId })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.userId, BigInt(userId)));

  const event: PresenceUpdateServerEvent = {
    op: 'PRESENCE_UPDATE',
    d: { userId, status },
  };

  const pubsub = getPubSubManager();

  // Broadcast to each server
  for (const membership of memberships) {
    const serverId = membership.serverId.toString();
    await pubsub.publishToServer(serverId, event);
  }
}

/**
 * Handle PRESENCE_UPDATE from a client.
 * Updates Redis presence key, updates DB, broadcasts to user's servers.
 */
export async function handlePresenceUpdate(
  app: FastifyInstance,
  ws: WebSocket,
  data: { status: UserStatus },
): Promise<void> {
  const meta = connectionManager.getMeta(ws);
  if (!meta) return;

  const { status } = data;
  if (!status || !['online', 'idle', 'dnd', 'offline'].includes(status)) return;

  await setPresence(app, meta.userId, status);
  await broadcastPresence(meta.userId, status);
}

/**
 * Handle user coming online (after IDENTIFY/READY).
 * Sets online status and broadcasts to all their servers.
 */
export async function handleConnect(
  app: FastifyInstance,
  userId: string,
): Promise<void> {
  await setPresence(app, userId, 'online');
  await broadcastPresence(userId, 'online');
}

/**
 * Handle user disconnecting.
 * Checks for other active connections; if none, sets offline and broadcasts.
 */
export async function handleDisconnect(
  app: FastifyInstance,
  userId: string,
  disconnectedWs: WebSocket,
): Promise<void> {
  // Check if the user has other active connections
  const hasOthers = connectionManager.hasOtherConnections(userId, disconnectedWs);

  if (!hasOthers) {
    await setPresence(app, userId, 'offline');
    await broadcastPresence(userId, 'offline');
  }
}

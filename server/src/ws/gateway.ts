import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type {
  ClientEvent,
  HelloEvent,
  HeartbeatAckEvent,
  ReadyEvent,
  ErrorEvent,
  UserStatus,
} from '@harmonium/shared';
import { connectionManager } from './index.js';
import type { ConnectionMeta } from './index.js';
import { getPubSubManager } from './pubsub.js';
import { handleTypingStart } from './handlers/typing.handler.js';
import { handlePresenceUpdate, handleConnect, handleDisconnect } from './handlers/presence.handler.js';
import { handleVoiceStateUpdate } from './handlers/voice-signal.handler.js';
import { leaveVoice } from '../modules/voice/voice.service.js';
import { isValidSnowflake } from '../utils/validation.js';
import { getDb, schema } from '../db/index.js';
import { eq, inArray } from 'drizzle-orm';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const HEARTBEAT_CHECK_INTERVAL = 45_000; // 45 seconds
const HEARTBEAT_TIMEOUT = 60_000; // 60 seconds
const IDENTIFY_TIMEOUT = 5_000; // 5 seconds

function send(ws: WebSocket, event: HelloEvent | HeartbeatAckEvent | ReadyEvent | ErrorEvent): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

function sendError(ws: WebSocket, code: number, message: string): void {
  send(ws, { op: 'ERROR', d: { code, message } });
}

export async function registerGateway(app: FastifyInstance): Promise<void> {
  app.get('/ws/gateway', { websocket: true }, (socket, _request) => {
    const ws: WebSocket = socket;
    const sessionId = crypto.randomUUID();
    let identified = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let identifyTimer: ReturnType<typeof setTimeout> | undefined;

    // Step 1: Send HELLO
    const helloEvent: HelloEvent = {
      op: 'HELLO',
      d: {
        heartbeatInterval: HEARTBEAT_INTERVAL,
        sessionId,
      },
    };
    send(ws, helloEvent);

    // Step 2: Set identify timeout - client must send IDENTIFY within 5 seconds
    identifyTimer = setTimeout(() => {
      if (!identified) {
        sendError(ws, 4001, 'Identify timeout - no IDENTIFY received within 5 seconds');
        ws.close(4001, 'Identify timeout');
      }
    }, IDENTIFY_TIMEOUT);

    // Handle incoming messages
    ws.on('message', async (raw: Buffer | ArrayBuffer | Buffer[]) => {
      let message: ClientEvent;
      try {
        const text = typeof raw === 'string' ? raw : raw.toString();
        message = JSON.parse(text) as ClientEvent;
      } catch {
        sendError(ws, 4002, 'Invalid JSON');
        return;
      }

      if (!message.op) {
        sendError(ws, 4002, 'Missing op field');
        return;
      }

      // Before IDENTIFY, only allow IDENTIFY messages
      if (!identified && message.op !== 'IDENTIFY') {
        sendError(ws, 4003, 'Not identified');
        return;
      }

      try {
        switch (message.op) {
          case 'IDENTIFY':
            await handleIdentify(ws, message.d, sessionId);
            break;
          case 'HEARTBEAT':
            handleHeartbeat(ws, message.d);
            break;
          case 'SUBSCRIBE_SERVER':
            if (!isValidSnowflake(message.d?.serverId)) {
              sendError(ws, 4002, 'Invalid serverId');
              break;
            }
            await handleSubscribeServer(ws, message.d);
            break;
          case 'UNSUBSCRIBE_SERVER':
            if (!isValidSnowflake(message.d?.serverId)) {
              sendError(ws, 4002, 'Invalid serverId');
              break;
            }
            await handleUnsubscribeServer(ws, message.d);
            break;
          case 'TYPING_START':
            if (!isValidSnowflake(message.d?.channelId)) {
              sendError(ws, 4002, 'Invalid channelId');
              break;
            }
            await handleTypingStart(app, ws, message.d);
            break;
          case 'PRESENCE_UPDATE':
            await handlePresenceUpdate(app, ws, message.d);
            break;
          case 'VOICE_STATE_UPDATE':
            await handleVoiceStateUpdate(app, ws, message.d);
            break;
          default:
            sendError(ws, 4004, `Unknown op: ${(message as ClientEvent).op}`);
        }
      } catch (err) {
        app.log.error(err, 'Error handling WebSocket message');
        sendError(ws, 4000, 'Internal server error');
      }
    });

    // Handle close
    ws.on('close', async () => {
      if (identifyTimer) clearTimeout(identifyTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);

      const meta = connectionManager.removeConnection(ws);
      if (meta) {
        // Leave voice channel if connected
        await leaveVoice(meta.userId);

        // Handle presence offline
        await handleDisconnect(app, meta.userId, ws);

        // Attempt to unsubscribe from server Redis channels if no more local connections
        const pubsub = getPubSubManager();
        for (const serverId of meta.subscribedServers) {
          await pubsub.unsubscribeFromServer(serverId);
        }
        await pubsub.unsubscribeFromUser(meta.userId);
      }
    });

    ws.on('error', (err: Error) => {
      app.log.error(err, 'WebSocket error');
    });

    /** Handle IDENTIFY: verify JWT, load user data, send READY */
    async function handleIdentify(
      socket: WebSocket,
      data: { token: string },
      sessId: string,
    ): Promise<void> {
      if (identified) {
        sendError(socket, 4005, 'Already identified');
        return;
      }

      const { token } = data;
      if (!token) {
        sendError(socket, 4006, 'Missing token');
        socket.close(4006, 'Missing token');
        return;
      }

      // Verify JWT
      let payload: { userId: string; username: string };
      try {
        payload = app.jwt.verify<{ userId: string; username: string }>(token);
      } catch {
        sendError(socket, 4007, 'Invalid or expired token');
        socket.close(4007, 'Invalid token');
        return;
      }

      // Clear identify timeout
      if (identifyTimer) {
        clearTimeout(identifyTimer);
        identifyTimer = undefined;
      }

      identified = true;
      const userId = payload.userId;

      // Load user data from DB
      const db = getDb();
      const userRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, BigInt(userId)))
        .limit(1);

      const userRow = userRows[0];
      if (!userRow) {
        sendError(socket, 4008, 'User not found');
        socket.close(4008, 'User not found');
        return;
      }

      // Load user's server list
      const memberRows = await db
        .select({
          serverId: schema.serverMembers.serverId,
        })
        .from(schema.serverMembers)
        .where(eq(schema.serverMembers.userId, BigInt(userId)));

      const serverIds = memberRows.map((r) => r.serverId);

      // Load server details
      let serverList: Array<{ id: string; name: string; iconUrl: string | null }> = [];
      if (serverIds.length > 0) {
        const serverRows = await db
          .select({
            id: schema.servers.id,
            name: schema.servers.name,
            iconUrl: schema.servers.iconUrl,
          })
          .from(schema.servers);

        // Filter to only servers the user is a member of
        const serverIdSet = new Set(serverIds.map((id) => id.toString()));
        serverList = serverRows
          .filter((s) => serverIdSet.has(s.id.toString()))
          .map((s) => ({
            id: s.id.toString(),
            name: s.name,
            iconUrl: s.iconUrl,
          }));
      }

      // Create connection meta
      const meta: ConnectionMeta = {
        userId,
        sessionId: sessId,
        subscribedServers: new Set(),
        lastHeartbeat: Date.now(),
        seq: 0,
      };

      connectionManager.addConnection(socket, meta);

      // Auto-subscribe to user's servers
      const pubsub = getPubSubManager();
      for (const server of serverList) {
        connectionManager.subscribeToServer(server.id, userId);
        await pubsub.subscribeToServer(server.id);
      }

      // Subscribe to user-specific channel
      await pubsub.subscribeToUser(userId);

      // Gather online presences for all co-members across the user's servers
      let presences: Array<{ userId: string; status: UserStatus }> = [];
      if (serverIds.length > 0) {
        const coMembers = await db
          .selectDistinct({ userId: schema.serverMembers.userId })
          .from(schema.serverMembers)
          .where(inArray(schema.serverMembers.serverId, serverIds));

        const coMemberIds = coMembers
          .map((m) => m.userId.toString())
          .filter((id) => id !== userId);

        if (coMemberIds.length > 0) {
          const redisKeys = coMemberIds.map((id) => `presence:${id}`);
          const statuses = await app.redis.mget(...redisKeys);
          for (let i = 0; i < coMemberIds.length; i++) {
            const status = statuses[i] as UserStatus | null;
            if (status && status !== 'offline') {
              presences.push({ userId: coMemberIds[i], status });
            }
          }
        }
      }

      // Send READY event
      const readyEvent: ReadyEvent = {
        op: 'READY',
        d: {
          user: {
            id: userRow.id.toString(),
            username: userRow.username,
            discriminator: userRow.discriminator,
            avatarUrl: userRow.avatarUrl,
            aboutMe: userRow.aboutMe,
            status: userRow.status as 'online' | 'idle' | 'dnd' | 'offline',
            customStatus: userRow.customStatus,
            createdAt: userRow.createdAt.toISOString(),
            updatedAt: userRow.updatedAt.toISOString(),
          },
          servers: serverList,
          sessionId: sessId,
          presences,
        },
      };

      send(socket, readyEvent);

      // Set user online and broadcast presence
      await handleConnect(app, userId);

      // Start heartbeat monitoring
      heartbeatTimer = setInterval(() => {
        const currentMeta = connectionManager.getMeta(socket);
        if (!currentMeta) {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          return;
        }
        const timeSinceLastHeartbeat = Date.now() - currentMeta.lastHeartbeat;
        if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
          app.log.info({ userId: currentMeta.userId, sessionId: currentMeta.sessionId },
            'Closing connection due to heartbeat timeout');
          socket.close(4009, 'Heartbeat timeout');
        }
      }, HEARTBEAT_CHECK_INTERVAL);
    }

    /** Handle HEARTBEAT: update lastHeartbeat and send ACK */
    function handleHeartbeat(
      socket: WebSocket,
      data: { seq: number },
    ): void {
      const meta = connectionManager.getMeta(socket);
      if (!meta) return;

      meta.lastHeartbeat = Date.now();
      if (typeof data.seq === 'number') {
        meta.seq = data.seq;
      }

      const ack: HeartbeatAckEvent = {
        op: 'HEARTBEAT_ACK',
        d: {},
      };
      send(socket, ack);
    }

    /** Handle SUBSCRIBE_SERVER: add server subscription */
    async function handleSubscribeServer(
      socket: WebSocket,
      data: { serverId: string },
    ): Promise<void> {
      const meta = connectionManager.getMeta(socket);
      if (!meta) return;

      const { serverId } = data;
      if (!serverId) return;

      connectionManager.subscribeToServer(serverId, meta.userId);
      const pubsub = getPubSubManager();
      await pubsub.subscribeToServer(serverId);
    }

    /** Handle UNSUBSCRIBE_SERVER: remove server subscription */
    async function handleUnsubscribeServer(
      socket: WebSocket,
      data: { serverId: string },
    ): Promise<void> {
      const meta = connectionManager.getMeta(socket);
      if (!meta) return;

      const { serverId } = data;
      if (!serverId) return;

      connectionManager.unsubscribeFromServer(serverId, meta.userId);
      const pubsub = getPubSubManager();
      await pubsub.unsubscribeFromServer(serverId);
    }
  });
}

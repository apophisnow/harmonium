# Task 6: WebSocket Gateway + Redis Pub/Sub

## Objective
Implement the WebSocket gateway using @fastify/websocket. Handle connection lifecycle (HELLO, IDENTIFY, heartbeat), server subscription management, and Redis pub/sub for broadcasting events across multiple server instances.

## Dependencies
- Task 2 (database schema) - for user queries
- Task 5 (auth module) - for JWT verification

## Pre-existing Files to Read
- `server/src/app.ts` - Fastify app factory
- `server/src/plugins/auth.ts` - JWT verification (need to verify WS tokens the same way)
- `server/src/plugins/redis.ts` - Redis client
- `server/src/config.ts` - Config
- `server/src/db/index.ts` - Database
- `server/src/db/schema/users.ts` - User queries
- `server/src/db/schema/servers.ts` - Server member queries
- `packages/shared/src/ws-events.ts` - All WebSocket event type definitions
- `packages/shared/src/types/*.ts` - Shared types

## Files to Create

### 1. `server/src/plugins/websocket.ts` - WebSocket Plugin Setup
Register @fastify/websocket with Fastify. Configure:
- Max payload: 64KB
- No per-message-deflate (chat messages are small, compression overhead not worth it)

### 2. `server/src/ws/index.ts` - Connection Manager
```typescript
export class ConnectionManager {
  // Map of userId -> Set of WebSocket connections (user can have multiple tabs)
  private connections: Map<string, Set<WebSocket>>;

  // Map of WebSocket -> connection metadata
  private metadata: Map<WebSocket, ConnectionMeta>;

  // Map of serverId -> Set of userIds subscribed to that server's events
  private serverSubscriptions: Map<string, Set<string>>;

  addConnection(userId: string, ws: WebSocket, sessionId: string): void;
  removeConnection(ws: WebSocket): void;
  getConnections(userId: string): Set<WebSocket> | undefined;

  subscribeToServer(userId: string, serverId: string): void;
  unsubscribeFromServer(userId: string, serverId: string): void;
  getServerSubscribers(serverId: string): Set<string>;

  // Send event to a specific user (all their connections)
  sendToUser(userId: string, event: ServerEvent): void;

  // Send event to all users subscribed to a server
  broadcastToServer(serverId: string, event: ServerEvent, excludeUserId?: string): void;

  // Send event to all users who have access to a channel
  broadcastToChannel(channelId: string, serverId: string, event: ServerEvent, excludeUserId?: string): void;
}

interface ConnectionMeta {
  userId: string;
  sessionId: string;
  subscribedServers: Set<string>;
  lastHeartbeat: number;
  seq: number;
}
```

### 3. `server/src/ws/gateway.ts` - Main WebSocket Route Handler
The core WebSocket handler registered at `/ws/gateway`:

Connection flow:
1. Client connects → server sends `HELLO` with `{ heartbeatInterval: 30000, sessionId: uuid }`
2. Client must send `IDENTIFY` with `{ token: "jwt..." }` within 5 seconds
3. Server verifies JWT, loads user data + server list from DB
4. Server sends `READY` with `{ user, servers, sessionId }`
5. Client sends `SUBSCRIBE_SERVER` for each server they want events from
6. Heartbeat loop: client sends `HEARTBEAT` every 30s, server responds with `HEARTBEAT_ACK`

Message dispatch:
- Parse incoming JSON
- Validate `op` field
- Route to appropriate handler based on opcode
- Handle errors gracefully (send ERROR event, don't crash connection)

Heartbeat monitoring:
- Track last heartbeat time per connection
- Run interval check (every 45s) - if no heartbeat received in 60s, close connection
- On close: clean up ConnectionManager, update presence to offline

```typescript
export function registerGateway(app: FastifyInstance, connectionManager: ConnectionManager): void {
  app.get('/ws/gateway', { websocket: true }, (socket, request) => {
    // ... connection handling
  });
}
```

### 4. `server/src/ws/pubsub.ts` - Redis Pub/Sub
For multi-instance scaling:
```typescript
export class PubSubManager {
  private subscriber: Redis;  // Dedicated Redis connection for subscribing
  private publisher: Redis;   // Separate connection for publishing
  private connectionManager: ConnectionManager;

  constructor(redisUrl: string, connectionManager: ConnectionManager);

  // Publish event to a server channel (all instances receive it)
  publishToServer(serverId: string, event: ServerEvent): Promise<void>;

  // Publish event to a specific user (across instances)
  publishToUser(userId: string, event: ServerEvent): Promise<void>;

  // Subscribe to channels for a server (called when first user subscribes)
  subscribeToServer(serverId: string): Promise<void>;

  // Unsubscribe when no more local users need this server's events
  unsubscribeFromServer(serverId: string): Promise<void>;

  // Handle incoming pub/sub messages - dispatch to local ConnectionManager
  private handleMessage(channel: string, message: string): void;
}
```

Redis channel naming:
- `ws:server:{serverId}` - server-wide events
- `ws:user:{userId}` - direct-to-user events

### 5. `server/src/ws/handlers/typing.handler.ts` - Typing Indicator
When receiving `TYPING_START` from client:
- Verify user has READ_MESSAGES permission in the channel
- Set Redis key `typing:{channelId}:{userId}` with 10-second TTL (dedup)
- If key didn't exist (new typing start), broadcast `TYPING_START` to channel via pub/sub
- Include username and timestamp in broadcast

### 6. `server/src/ws/handlers/presence.handler.ts` - Presence Updates
When receiving `PRESENCE_UPDATE`:
- Update user status in Redis: `presence:{userId}` = status
- Update user status in DB (users table)
- Broadcast `PRESENCE_UPDATE` to all servers the user is a member of

On connection (after IDENTIFY):
- Set presence to 'online' in Redis
- Broadcast presence update

On disconnect:
- Check if user has any other active connections (multiple tabs)
- If no other connections, set presence to 'offline'
- Broadcast presence update

### 7. Update `server/src/app.ts`
Register the WebSocket plugin and gateway route.

## Important Implementation Notes
- Use `crypto.randomUUID()` for session IDs
- WebSocket messages are JSON strings - always try/catch JSON.parse
- Use a separate Redis connection for the subscriber (Redis pub/sub requires a dedicated connection)
- The ConnectionManager is a singleton per Fastify instance
- Export the ConnectionManager and PubSubManager instances so other modules (messages, channels) can publish events

## Acceptance Criteria
- [ ] WebSocket endpoint at `/ws/gateway` accepts connections
- [ ] HELLO sent immediately on connect with heartbeat interval
- [ ] IDENTIFY validates JWT, sends READY with user + servers
- [ ] Connection closed if IDENTIFY not received within 5 seconds
- [ ] Heartbeat mechanism works (HEARTBEAT → HEARTBEAT_ACK)
- [ ] Stale connections (missed heartbeats) are cleaned up
- [ ] SUBSCRIBE_SERVER/UNSUBSCRIBE_SERVER manage event routing
- [ ] Redis pub/sub publishes and receives events across instances
- [ ] Typing indicators broadcast with deduplication
- [ ] Presence updates on connect, disconnect, and explicit update
- [ ] Multiple connections per user handled correctly
- [ ] All errors handled gracefully (bad JSON, unknown op, etc.)
- [ ] TypeScript compilation passes

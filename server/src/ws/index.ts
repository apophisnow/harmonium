import type { WebSocket } from 'ws';
import type { ServerEvent } from '@harmonium/shared';

export interface ConnectionMeta {
  userId: string;
  sessionId: string;
  subscribedServers: Set<string>;
  lastHeartbeat: number;
  seq: number;
}

export class ConnectionManager {
  /** userId -> Set of WebSocket connections */
  private connections = new Map<string, Set<WebSocket>>();

  /** ws -> ConnectionMeta */
  private metadata = new Map<WebSocket, ConnectionMeta>();

  /** serverId -> Set of userIds subscribed */
  private serverSubscriptions = new Map<string, Set<string>>();

  addConnection(ws: WebSocket, meta: ConnectionMeta): void {
    this.metadata.set(ws, meta);

    let userConns = this.connections.get(meta.userId);
    if (!userConns) {
      userConns = new Set();
      this.connections.set(meta.userId, userConns);
    }
    userConns.add(ws);
  }

  removeConnection(ws: WebSocket): ConnectionMeta | undefined {
    const meta = this.metadata.get(ws);
    if (!meta) return undefined;

    this.metadata.delete(ws);

    const userConns = this.connections.get(meta.userId);
    if (userConns) {
      userConns.delete(ws);
      if (userConns.size === 0) {
        this.connections.delete(meta.userId);
      }
    }

    // Unsubscribe from all servers
    for (const serverId of meta.subscribedServers) {
      const subscribers = this.serverSubscriptions.get(serverId);
      if (subscribers) {
        subscribers.delete(meta.userId);
        if (subscribers.size === 0) {
          this.serverSubscriptions.delete(serverId);
        }
      }
    }

    return meta;
  }

  getConnections(userId: string): Set<WebSocket> | undefined {
    return this.connections.get(userId);
  }

  getMeta(ws: WebSocket): ConnectionMeta | undefined {
    return this.metadata.get(ws);
  }

  hasOtherConnections(userId: string, excludeWs?: WebSocket): boolean {
    const conns = this.connections.get(userId);
    if (!conns) return false;
    if (!excludeWs) return conns.size > 0;
    // Check if there are connections other than the excluded one
    for (const ws of conns) {
      if (ws !== excludeWs) return true;
    }
    return false;
  }

  subscribeToServer(serverId: string, userId: string): void {
    let subscribers = this.serverSubscriptions.get(serverId);
    if (!subscribers) {
      subscribers = new Set();
      this.serverSubscriptions.set(serverId, subscribers);
    }
    subscribers.add(userId);

    // Also track in user's meta for all their connections
    const userConns = this.connections.get(userId);
    if (userConns) {
      for (const ws of userConns) {
        const meta = this.metadata.get(ws);
        if (meta) {
          meta.subscribedServers.add(serverId);
        }
      }
    }
  }

  unsubscribeFromServer(serverId: string, userId: string): void {
    const subscribers = this.serverSubscriptions.get(serverId);
    if (subscribers) {
      subscribers.delete(userId);
      if (subscribers.size === 0) {
        this.serverSubscriptions.delete(serverId);
      }
    }

    // Also remove from user's meta
    const userConns = this.connections.get(userId);
    if (userConns) {
      for (const ws of userConns) {
        const meta = this.metadata.get(ws);
        if (meta) {
          meta.subscribedServers.delete(serverId);
        }
      }
    }
  }

  getServerSubscribers(serverId: string): Set<string> {
    return this.serverSubscriptions.get(serverId) ?? new Set();
  }

  /** Check if any local user is subscribed to this server */
  hasLocalSubscribers(serverId: string): boolean {
    const subs = this.serverSubscriptions.get(serverId);
    return subs !== undefined && subs.size > 0;
  }

  sendToUser(userId: string, event: ServerEvent): void {
    const conns = this.connections.get(userId);
    if (!conns) return;

    const payload = JSON.stringify(event);
    for (const ws of conns) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }

  broadcastToServer(serverId: string, event: ServerEvent, excludeUserId?: string): void {
    const subscribers = this.serverSubscriptions.get(serverId);
    if (!subscribers) return;

    const payload = JSON.stringify(event);
    for (const userId of subscribers) {
      if (userId === excludeUserId) continue;
      const conns = this.connections.get(userId);
      if (!conns) continue;
      for (const ws of conns) {
        if (ws.readyState === ws.OPEN) {
          ws.send(payload);
        }
      }
    }
  }

  broadcastToChannel(serverId: string, event: ServerEvent, excludeUserId?: string): void {
    // Channels belong to servers, so we broadcast to server subscribers
    // Fine-grained channel-level filtering can be added later
    this.broadcastToServer(serverId, event, excludeUserId);
  }

  send(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}

/** Singleton ConnectionManager instance */
export const connectionManager = new ConnectionManager();

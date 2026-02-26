import { useEffect, useRef, useCallback, useState } from 'react';
import type { ClientEvent, ServerEvent } from '@harmonium/shared';
import { useAuthStore } from '../stores/auth.store.js';
import { useToastStore } from '../stores/toast.store.js';
import { useMessageStore } from '../stores/message.store.js';
import { usePresenceStore } from '../stores/presence.store.js';
import { useMemberStore } from '../stores/member.store.js';
import { useChannelStore } from '../stores/channel.store.js';
import { useServerStore } from '../stores/server.store.js';
import { useVoiceStore } from '../stores/voice.store.js';

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/gateway`;

const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_ATTEMPTS = 20;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const seqRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  const token = useAuthStore((s) => s.accessToken);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const addMessage = useMessageStore((s) => s.addMessage);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const deleteMessage = useMessageStore((s) => s.deleteMessage);
  const addReactionToStore = useMessageStore((s) => s.addReaction);
  const removeReactionFromStore = useMessageStore((s) => s.removeReaction);

  const setPresence = usePresenceStore((s) => s.setPresence);
  const bulkSetPresence = usePresenceStore((s) => s.bulkSetPresence);

  const addMember = useMemberStore((s) => s.addMember);
  const removeMember = useMemberStore((s) => s.removeMember);
  const updateMemberUser = useMemberStore((s) => s.updateMemberUser);
  const updateMemberRoles = useMemberStore((s) => s.updateMemberRoles);

  const addChannel = useChannelStore((s) => s.addChannel);
  const updateChannel = useChannelStore((s) => s.updateChannel);
  const removeChannel = useChannelStore((s) => s.removeChannel);

  const removeServer = useServerStore((s) => s.removeServer);
  const updateServer = useServerStore((s) => s.updateServer);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const sendEvent = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  // Keep handleMessage in a ref so the WebSocket onmessage handler always
  // calls the latest version without needing to recreate `connect`.
  const handleMessageRef = useRef<(data: ServerEvent) => void>(() => {});

  handleMessageRef.current = (data: ServerEvent) => {
    switch (data.op) {
      case 'HELLO': {
        // Send IDENTIFY with the latest token from the ref
        const currentToken = tokenRef.current;
        if (currentToken) {
          sendEvent({ op: 'IDENTIFY', d: { token: currentToken } });
        }
        // Start heartbeat
        clearHeartbeat();
        const interval = data.d.heartbeatInterval;
        heartbeatRef.current = setInterval(() => {
          seqRef.current += 1;
          sendEvent({ op: 'HEARTBEAT', d: { seq: seqRef.current } });
        }, interval);
        break;
      }
      case 'HEARTBEAT_ACK':
        // Connection still alive
        break;
      case 'READY': {
        if (reconnectAttemptRef.current > 0) {
          useToastStore.getState().addToast('success', 'Reconnected to server');
        }
        // Set own presence + all online co-members from the server
        const currentUserId = useAuthStore.getState().user?.id;
        const entries = data.d.presences ?? [];
        if (currentUserId) {
          entries.push({ userId: currentUserId, status: 'online' });
        }
        if (entries.length > 0) {
          bulkSetPresence(entries);
        }
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
        break;
      }
      case 'MESSAGE_CREATE':
        addMessage(data.d.message);
        break;
      case 'MESSAGE_UPDATE':
        updateMessage(data.d.message);
        break;
      case 'MESSAGE_DELETE':
        deleteMessage(data.d.channelId, data.d.id);
        break;
      case 'REACTION_ADD':
        addReactionToStore(data.d.channelId, data.d.messageId, data.d.userId, data.d.emoji);
        break;
      case 'REACTION_REMOVE':
        removeReactionFromStore(data.d.channelId, data.d.messageId, data.d.userId, data.d.emoji);
        break;
      case 'PRESENCE_UPDATE':
        setPresence(data.d.userId, data.d.status);
        break;
      case 'USER_UPDATE':
        updateMemberUser(data.d.user);
        break;
      case 'MEMBER_JOIN':
        addMember(data.d.serverId, data.d.member);
        break;
      case 'MEMBER_LEAVE':
        removeMember(data.d.serverId, data.d.userId);
        break;
      case 'MEMBER_UPDATE':
        updateMemberRoles(data.d.serverId, data.d.userId, data.d.roles);
        break;
      case 'ROLE_UPDATE':
        window.dispatchEvent(
          new CustomEvent('ws:role_update', { detail: data.d }),
        );
        break;
      case 'CHANNEL_CREATE':
        addChannel(data.d.channel);
        break;
      case 'CHANNEL_UPDATE':
        updateChannel(data.d.channel);
        break;
      case 'CHANNEL_DELETE':
        removeChannel(data.d.channelId, data.d.serverId);
        break;
      case 'SERVER_UPDATE':
        updateServer(data.d.server);
        break;
      case 'SERVER_DELETE':
        removeServer(data.d.serverId);
        break;
      case 'TYPING_START':
        // Handled by useTypingIndicator via a custom event
        window.dispatchEvent(
          new CustomEvent('ws:typing_start', { detail: data.d }),
        );
        break;
      case 'VOICE_STATE_UPDATE': {
        // Update server-wide channel voice states for sidebar display
        const vsData = data.d as { userId: string; channelId: string; username: string; selfMute: boolean; selfDeaf: boolean };
        if (!vsData.channelId || vsData.channelId === '') {
          useVoiceStore.getState().removeChannelVoiceUser(vsData.userId);
        } else {
          useVoiceStore.getState().addChannelVoiceUser(vsData.channelId, {
            userId: vsData.userId,
            username: vsData.username,
            avatarUrl: null,
            selfMute: vsData.selfMute,
            selfDeaf: vsData.selfDeaf,
            isScreenSharing: false,
            hasWebcam: false,
          });
        }
        // Dispatch for useVoice hook (mediasoup handling)
        window.dispatchEvent(
          new CustomEvent('ws:voice_state_update', { detail: data.d }),
        );
        break;
      }
      case 'NEW_PRODUCER': {
        const npData = data.d as { producerId: string; userId: string; kind: string; channelId: string; producerType: string };
        if (npData.kind === 'video') {
          useVoiceStore.getState().updateChannelVoiceUser(npData.channelId, npData.userId, {
            isScreenSharing: npData.producerType === 'screenShare' ? true : undefined,
            hasWebcam: npData.producerType === 'webcam' ? true : undefined,
          });
        }
        window.dispatchEvent(
          new CustomEvent('ws:new_producer', { detail: data.d }),
        );
        break;
      }
      case 'PRODUCER_CLOSED': {
        const pcData = data.d as { producerId: string; userId: string; kind: string; channelId: string; producerType: string };
        if (pcData.kind === 'video') {
          useVoiceStore.getState().updateChannelVoiceUser(pcData.channelId, pcData.userId, {
            isScreenSharing: pcData.producerType === 'screenShare' ? false : undefined,
            hasWebcam: pcData.producerType === 'webcam' ? false : undefined,
          });
        }
        window.dispatchEvent(
          new CustomEvent('ws:producer_closed', { detail: data.d }),
        );
        break;
      }
      case 'ERROR':
        console.error('[WS] Server error:', data.d.message);
        break;
    }
  };

  // `connect` is stable — it reads token and handleMessage from refs,
  // so the reconnection timer is never cancelled by React effect cleanup.
  const connect = useCallback(() => {
    if (!tokenRef.current) return;
    // Prevent duplicate connections if one is already open or connecting
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as ServerEvent;
        handleMessageRef.current(data);
      } catch {
        console.error('[WS] Failed to parse message');
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      clearHeartbeat();

      if (reconnectAttemptRef.current === 0) {
        useToastStore.getState().addToast('info', 'Disconnected from server. Reconnecting...');
      }

      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        useToastStore.getState().addToast('error', 'Connection lost. Please refresh the page.');
        return;
      }

      // Reconnect with exponential backoff
      const delay = Math.min(
        BASE_RECONNECT_DELAY * 2 ** reconnectAttemptRef.current,
        MAX_RECONNECT_DELAY,
      );
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [clearHeartbeat]);

  // Connect when token becomes available, disconnect when it goes away.
  // Because `connect` is stable, this effect only re-runs when `token` changes.
  useEffect(() => {
    if (token) {
      connect();
    } else {
      // Token cleared (logout) — tear down everything
      clearHeartbeat();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      reconnectAttemptRef.current = 0;
    }

    return () => {
      clearHeartbeat();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, connect, clearHeartbeat]);

  return { isConnected, sendEvent };
}

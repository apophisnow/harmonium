import type { Message } from './types/message.js';
import type { PublicUser, UserStatus } from './types/user.js';
import type { Channel } from './types/channel.js';
import type { Server, ServerMember } from './types/server.js';
import type { Role } from './types/role.js';
import type { VoiceState, ProducerType } from './types/voice.js';

// ===== Client-to-Server Events =====

export interface IdentifyEvent {
  op: 'IDENTIFY';
  d: { token: string };
}

export interface HeartbeatEvent {
  op: 'HEARTBEAT';
  d: { seq: number };
}

export interface SubscribeServerEvent {
  op: 'SUBSCRIBE_SERVER';
  d: { serverId: string };
}

export interface UnsubscribeServerEvent {
  op: 'UNSUBSCRIBE_SERVER';
  d: { serverId: string };
}

export interface TypingStartClientEvent {
  op: 'TYPING_START';
  d: { channelId: string };
}

export interface PresenceUpdateClientEvent {
  op: 'PRESENCE_UPDATE';
  d: { status: UserStatus };
}

export interface VoiceStateUpdateClientEvent {
  op: 'VOICE_STATE_UPDATE';
  d: { channelId: string | null; selfMute: boolean; selfDeaf: boolean };
}

export type ClientEvent =
  | IdentifyEvent
  | HeartbeatEvent
  | SubscribeServerEvent
  | UnsubscribeServerEvent
  | TypingStartClientEvent
  | PresenceUpdateClientEvent
  | VoiceStateUpdateClientEvent;

// ===== Server-to-Client Events =====

export interface HelloEvent {
  op: 'HELLO';
  d: { heartbeatInterval: number; sessionId: string };
}

export interface HeartbeatAckEvent {
  op: 'HEARTBEAT_ACK';
  d: Record<string, never>;
}

export interface ReadyEvent {
  op: 'READY';
  d: {
    user: PublicUser;
    servers: Array<{ id: string; name: string; iconUrl: string | null }>;
    sessionId: string;
    presences: Array<{ userId: string; status: UserStatus }>;
  };
}

export interface MessageCreateEvent {
  op: 'MESSAGE_CREATE';
  d: { message: Message };
}

export interface MessageUpdateEvent {
  op: 'MESSAGE_UPDATE';
  d: { message: Partial<Message> & { id: string; channelId: string } };
}

export interface MessageDeleteEvent {
  op: 'MESSAGE_DELETE';
  d: { id: string; channelId: string };
}

export interface TypingStartServerEvent {
  op: 'TYPING_START';
  d: { channelId: string; userId: string; username: string; timestamp: number };
}

export interface PresenceUpdateServerEvent {
  op: 'PRESENCE_UPDATE';
  d: { userId: string; status: UserStatus };
}

export interface MemberJoinEvent {
  op: 'MEMBER_JOIN';
  d: { serverId: string; member: ServerMember };
}

export interface MemberLeaveEvent {
  op: 'MEMBER_LEAVE';
  d: { serverId: string; userId: string };
}

export interface ChannelCreateEvent {
  op: 'CHANNEL_CREATE';
  d: { channel: Channel };
}

export interface ChannelUpdateEvent {
  op: 'CHANNEL_UPDATE';
  d: { channel: Channel };
}

export interface ChannelDeleteEvent {
  op: 'CHANNEL_DELETE';
  d: { channelId: string; serverId: string };
}

export interface ServerUpdateEvent {
  op: 'SERVER_UPDATE';
  d: { server: Server };
}

export interface ServerDeleteEvent {
  op: 'SERVER_DELETE';
  d: { serverId: string };
}

export interface VoiceStateUpdateServerEvent {
  op: 'VOICE_STATE_UPDATE';
  d: VoiceState & { username: string };
}

export interface NewProducerServerEvent {
  op: 'NEW_PRODUCER';
  d: {
    producerId: string;
    userId: string;
    kind: 'audio' | 'video';
    producerType: ProducerType;
    channelId: string;
    serverId: string;
  };
}

export interface ProducerClosedServerEvent {
  op: 'PRODUCER_CLOSED';
  d: {
    producerId: string;
    userId: string;
    kind: 'audio' | 'video';
    producerType: ProducerType;
    channelId: string;
    serverId: string;
  };
}

export interface MemberUpdateEvent {
  op: 'MEMBER_UPDATE';
  d: { serverId: string; userId: string; roles: string[] };
}

export interface RoleUpdateEvent {
  op: 'ROLE_UPDATE';
  d: { serverId: string; role: Role };
}

export interface UserUpdateEvent {
  op: 'USER_UPDATE';
  d: { user: PublicUser };
}

export interface ErrorEvent {
  op: 'ERROR';
  d: { code: number; message: string };
}

export type ServerEvent =
  | HelloEvent
  | HeartbeatAckEvent
  | ReadyEvent
  | MessageCreateEvent
  | MessageUpdateEvent
  | MessageDeleteEvent
  | TypingStartServerEvent
  | PresenceUpdateServerEvent
  | UserUpdateEvent
  | MemberJoinEvent
  | MemberLeaveEvent
  | MemberUpdateEvent
  | RoleUpdateEvent
  | ChannelCreateEvent
  | ChannelUpdateEvent
  | ChannelDeleteEvent
  | ServerUpdateEvent
  | ServerDeleteEvent
  | VoiceStateUpdateServerEvent
  | NewProducerServerEvent
  | ProducerClosedServerEvent
  | ErrorEvent;

// Union of all events
export type GatewayEvent = ClientEvent | ServerEvent;

// Helper to extract event data type by opcode
export type EventData<T extends GatewayEvent['op']> = Extract<GatewayEvent, { op: T }>['d'];

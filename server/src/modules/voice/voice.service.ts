import { eq, and } from 'drizzle-orm';
import type { DtlsParameters, MediaKind, RtpParameters, RtpCapabilities } from 'mediasoup/types';
import { getDb, schema } from '../../db/index.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { computeChannelPermissions } from '../../utils/permissions.js';
import { Permission, hasPermission, type ProducerType } from '@harmonium/shared';
import { getPubSubManager } from '../../ws/pubsub.js';
import { getVoiceServer } from '../../voice/voice-server.js';

// ===== Helpers =====

/** Map to track which channel each user is currently in (userId -> channelId) */
const userChannelMap = new Map<string, string>();

function voiceStateToResponse(
  row: typeof schema.voiceStates.$inferSelect,
  username: string,
) {
  return {
    userId: row.userId.toString(),
    channelId: row.channelId.toString(),
    serverId: row.serverId.toString(),
    selfMute: row.selfMute,
    selfDeaf: row.selfDeaf,
    joinedAt: row.joinedAt.toISOString(),
    username,
  };
}

async function getChannelWithValidation(channelId: string) {
  const db = getDb();
  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, BigInt(channelId)),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  if (channel.type !== 'voice') {
    throw new ValidationError('Channel is not a voice channel');
  }

  return channel;
}

async function getUserUsername(userId: string): Promise<string> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(userId)),
    columns: { username: true },
  });
  return user?.username ?? 'Unknown';
}

// ===== Service Functions =====

export async function joinVoice(userId: string, channelId: string) {
  const db = getDb();

  // Validate channel exists and is a voice channel
  const channel = await getChannelWithValidation(channelId);
  const serverId = channel.serverId.toString();

  // Check CONNECT permission
  const permissions = await computeChannelPermissions(db, serverId, channelId, userId);
  if (!hasPermission(permissions, Permission.CONNECT)) {
    throw new ForbiddenError('You do not have permission to connect to this voice channel');
  }

  // If user is already in a voice channel, leave it first
  const existingChannelId = userChannelMap.get(userId);
  if (existingChannelId) {
    await leaveVoice(userId);
  }

  // Get or create the voice room
  const voiceServer = getVoiceServer();
  const room = await voiceServer.getOrCreateRoom(channelId);

  // Add the peer and get transport info
  const transportInfo = await room.addPeer(userId);

  // Track user's channel
  userChannelMap.set(userId, channelId);

  // Insert voice state into DB
  await db
    .insert(schema.voiceStates)
    .values({
      userId: BigInt(userId),
      channelId: BigInt(channelId),
      serverId: BigInt(serverId),
      selfMute: false,
      selfDeaf: false,
    })
    .onConflictDoUpdate({
      target: schema.voiceStates.userId,
      set: {
        channelId: BigInt(channelId),
        serverId: BigInt(serverId),
        selfMute: false,
        selfDeaf: false,
        joinedAt: new Date(),
      },
    });

  // Broadcast VOICE_STATE_UPDATE
  const username = await getUserUsername(userId);
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'VOICE_STATE_UPDATE' as const,
    d: {
      userId,
      channelId,
      serverId,
      selfMute: false,
      selfDeaf: false,
      joinedAt: new Date().toISOString(),
      username,
    },
  });

  // Get existing producers from other peers in the room
  const existingProducers = room.getOtherProducerIds(userId);

  return {
    ...transportInfo,
    existingProducers,
  };
}

export async function connectTransport(
  userId: string,
  channelId: string,
  transportId: string,
  dtlsParameters: DtlsParameters,
) {
  const db = getDb();

  // Verify CONNECT permission at the DB level
  const channel = await getChannelWithValidation(channelId);
  const serverId = channel.serverId.toString();
  const permissions = await computeChannelPermissions(db, serverId, channelId, userId);
  if (!hasPermission(permissions, Permission.CONNECT)) {
    throw new ForbiddenError('You do not have permission to connect to this voice channel');
  }

  const voiceServer = getVoiceServer();
  const room = voiceServer.getRoom(channelId);

  if (!room) {
    throw new NotFoundError('Voice room not found');
  }

  if (!room.hasPeer(userId)) {
    throw new ForbiddenError('You are not in this voice channel');
  }

  await room.connectTransport(userId, transportId, dtlsParameters);
}

export async function produce(
  userId: string,
  channelId: string,
  transportId: string,
  kind: MediaKind,
  rtpParameters: RtpParameters,
  producerType?: ProducerType,
) {
  const db = getDb();

  // Determine the producer type: default to 'audio' for audio kind, require it for video
  let resolvedProducerType: ProducerType;
  if (kind === 'audio') {
    resolvedProducerType = 'audio';
  } else {
    if (!producerType || producerType === 'audio') {
      throw new ValidationError('producerType must be "screenShare" or "webcam" for video producers');
    }
    resolvedProducerType = producerType;
  }

  // Check SPEAK permission
  const channel = await getChannelWithValidation(channelId);
  const serverId = channel.serverId.toString();

  const permissions = await computeChannelPermissions(db, serverId, channelId, userId);

  if (kind === 'video') {
    if (!hasPermission(permissions, Permission.STREAM)) {
      throw new ForbiddenError('You do not have permission to share your screen in this voice channel');
    }
  } else {
    if (!hasPermission(permissions, Permission.SPEAK)) {
      throw new ForbiddenError('You do not have permission to speak in this voice channel');
    }
  }

  const voiceServer = getVoiceServer();
  const room = voiceServer.getRoom(channelId);

  if (!room) {
    throw new NotFoundError('Voice room not found');
  }

  if (!room.hasPeer(userId)) {
    throw new ForbiddenError('You are not in this voice channel');
  }

  // For screen share, check if someone else is already sharing
  if (resolvedProducerType === 'screenShare') {
    const currentSharer = room.getScreenSharerUserId();
    if (currentSharer && currentSharer !== userId) {
      throw new ForbiddenError('Someone else is already sharing their screen');
    }
  }

  const producerId = await room.produce(userId, transportId, kind, rtpParameters, resolvedProducerType);

  // Notify other peers about the new producer via WebSocket
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'NEW_PRODUCER' as const,
    d: { producerId, userId, kind, channelId, serverId, producerType: resolvedProducerType },
  }, userId);

  return { producerId };
}

export async function consume(
  userId: string,
  channelId: string,
  producerId: string,
  rtpCapabilities: RtpCapabilities,
) {
  const db = getDb();

  // Verify CONNECT permission at the DB level
  const channel = await getChannelWithValidation(channelId);
  const serverId = channel.serverId.toString();
  const permissions = await computeChannelPermissions(db, serverId, channelId, userId);
  if (!hasPermission(permissions, Permission.CONNECT)) {
    throw new ForbiddenError('You do not have permission to connect to this voice channel');
  }

  const voiceServer = getVoiceServer();
  const room = voiceServer.getRoom(channelId);

  if (!room) {
    throw new NotFoundError('Voice room not found');
  }

  if (!room.hasPeer(userId)) {
    throw new ForbiddenError('You are not in this voice channel');
  }

  const consumerInfo = await room.consume(userId, producerId, rtpCapabilities);

  const consumerProducerType = room.producerMetadata.get(producerId) ?? 'audio';

  return { ...consumerInfo, producerType: consumerProducerType };
}

export async function leaveVoice(userId: string) {
  const channelId = userChannelMap.get(userId);
  if (!channelId) return;

  const db = getDb();

  // Get the voice state before deleting
  const voiceState = await db.query.voiceStates.findFirst({
    where: eq(schema.voiceStates.userId, BigInt(userId)),
  });

  const serverId = voiceState?.serverId.toString();

  // Remove from voice room
  const voiceServer = getVoiceServer();
  const room = voiceServer.getRoom(channelId);
  if (room) {
    // Broadcast PRODUCER_CLOSED for any video producers before removing peer
    if (serverId) {
      const producers = room.getProducersByUser(userId);
      const pubsub = getPubSubManager();
      for (const { producerId, kind } of producers) {
        if (kind === 'video') {
          const producerType = room.producerMetadata.get(producerId) ?? 'screenShare';
          await pubsub.publishToServer(serverId, {
            op: 'PRODUCER_CLOSED' as const,
            d: { producerId, userId, kind: 'video', channelId, serverId, producerType },
          });
        }
      }
    }

    await room.removePeer(userId);

    // Clean up empty rooms
    if (room.isEmpty) {
      voiceServer.removeRoom(channelId);
    }
  }

  // Remove tracking
  userChannelMap.delete(userId);

  // Delete voice state from DB
  await db
    .delete(schema.voiceStates)
    .where(eq(schema.voiceStates.userId, BigInt(userId)));

  // Broadcast VOICE_STATE_UPDATE with null channel (user left)
  if (serverId) {
    const username = await getUserUsername(userId);
    const pubsub = getPubSubManager();
    await pubsub.publishToServer(serverId, {
      op: 'VOICE_STATE_UPDATE' as const,
      d: {
        userId,
        channelId: '',
        serverId,
        selfMute: false,
        selfDeaf: false,
        joinedAt: new Date().toISOString(),
        username,
      },
    });
  }
}

export async function stopScreenShare(userId: string) {
  const channelId = userChannelMap.get(userId);
  if (!channelId) return;

  const voiceServer = getVoiceServer();
  const room = voiceServer.getRoom(channelId);
  if (!room) return;

  const producers = room.getProducersByUser(userId);

  // Get channel to find serverId
  const db = getDb();
  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, BigInt(channelId)),
  });
  if (!channel) return;
  const serverId = channel.serverId.toString();

  const pubsub = getPubSubManager();
  for (const { producerId, kind } of producers) {
    if (kind === 'video') {
      const producerType = room.producerMetadata.get(producerId) ?? 'screenShare';
      await room.closeProducer(userId, producerId);
      await pubsub.publishToServer(serverId, {
        op: 'PRODUCER_CLOSED' as const,
        d: { producerId, userId, kind: 'video', channelId, serverId, producerType },
      });
    }
  }
}

export async function updateVoiceState(
  userId: string,
  selfMute: boolean,
  selfDeaf: boolean,
) {
  const channelId = userChannelMap.get(userId);
  if (!channelId) return;

  const db = getDb();

  // Update the voice state in DB
  const [updated] = await db
    .update(schema.voiceStates)
    .set({ selfMute, selfDeaf })
    .where(eq(schema.voiceStates.userId, BigInt(userId)))
    .returning();

  if (!updated) return;

  // Broadcast the update
  const username = await getUserUsername(userId);
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(updated.serverId.toString(), {
    op: 'VOICE_STATE_UPDATE' as const,
    d: voiceStateToResponse(updated, username),
  });
}

export async function getVoiceStates(serverId: string) {
  const db = getDb();

  const states = await db
    .select({
      voiceState: schema.voiceStates,
      user: schema.users,
    })
    .from(schema.voiceStates)
    .innerJoin(schema.users, eq(schema.voiceStates.userId, schema.users.id))
    .where(eq(schema.voiceStates.serverId, BigInt(serverId)));

  return states.map((row) =>
    voiceStateToResponse(row.voiceState, row.user.username),
  );
}

/** Get the channelId a user is currently in (if any) */
export function getUserChannelId(userId: string): string | undefined {
  return userChannelMap.get(userId);
}

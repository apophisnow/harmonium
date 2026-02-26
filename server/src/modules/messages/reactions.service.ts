import { eq, and, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import { broadcastReactionAdd, broadcastReactionRemove } from '../../ws/handlers/reaction.handler.js';
import type { Reaction } from '@harmonium/shared';

const MAX_UNIQUE_EMOJIS_PER_MESSAGE = 20;

async function getChannelWithServer(channelId: string) {
  const db = getDb();
  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, BigInt(channelId)),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  return channel;
}

export async function addReaction(
  channelId: string,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const db = getDb();
  const messageIdBigInt = BigInt(messageId);

  // Verify message exists and belongs to this channel
  const message = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.id, messageIdBigInt),
      eq(schema.messages.channelId, BigInt(channelId)),
    ),
  });

  if (!message || message.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  // Check max unique emojis per message
  const uniqueEmojis = await db
    .selectDistinct({ emoji: schema.reactions.emoji })
    .from(schema.reactions)
    .where(eq(schema.reactions.messageId, messageIdBigInt));

  if (uniqueEmojis.length >= MAX_UNIQUE_EMOJIS_PER_MESSAGE && !uniqueEmojis.some((r) => r.emoji === emoji)) {
    throw new ValidationError(`Maximum of ${MAX_UNIQUE_EMOJIS_PER_MESSAGE} unique reactions per message`);
  }

  // Insert with ON CONFLICT DO NOTHING (idempotent)
  await db
    .insert(schema.reactions)
    .values({
      messageId: messageIdBigInt,
      userId: BigInt(userId),
      emoji,
    })
    .onConflictDoNothing();

  // Broadcast
  const channel = await getChannelWithServer(channelId);
  const serverId = channel.serverId.toString();
  const pubsub = getPubSubManager();
  broadcastReactionAdd(pubsub, serverId, channelId, messageId, userId, emoji);
}

export async function removeReaction(
  channelId: string,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const db = getDb();
  const messageIdBigInt = BigInt(messageId);

  // Verify message exists and belongs to this channel
  const message = await db.query.messages.findFirst({
    where: and(
      eq(schema.messages.id, messageIdBigInt),
      eq(schema.messages.channelId, BigInt(channelId)),
    ),
  });

  if (!message || message.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  await db
    .delete(schema.reactions)
    .where(
      and(
        eq(schema.reactions.messageId, messageIdBigInt),
        eq(schema.reactions.userId, BigInt(userId)),
        eq(schema.reactions.emoji, emoji),
      ),
    );

  // Broadcast
  const channel = await getChannelWithServer(channelId);
  const serverId = channel.serverId.toString();
  const pubsub = getPubSubManager();
  broadcastReactionRemove(pubsub, serverId, channelId, messageId, userId, emoji);
}

export async function getReactionsForMessages(messageIds: bigint[]): Promise<Map<string, Reaction[]>> {
  if (messageIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      messageId: schema.reactions.messageId,
      emoji: schema.reactions.emoji,
      userId: schema.reactions.userId,
    })
    .from(schema.reactions)
    .where(inArray(schema.reactions.messageId, messageIds));

  // Group by messageId, then by emoji
  const map = new Map<string, Map<string, string[]>>();

  for (const row of rows) {
    const msgKey = row.messageId.toString();
    let emojiMap = map.get(msgKey);
    if (!emojiMap) {
      emojiMap = new Map();
      map.set(msgKey, emojiMap);
    }

    const userIds = emojiMap.get(row.emoji);
    if (userIds) {
      userIds.push(row.userId.toString());
    } else {
      emojiMap.set(row.emoji, [row.userId.toString()]);
    }
  }

  // Convert to Reaction[]
  const result = new Map<string, Reaction[]>();
  for (const [msgKey, emojiMap] of map) {
    const reactions: Reaction[] = [];
    for (const [emoji, userIds] of emojiMap) {
      reactions.push({ emoji, count: userIds.length, userIds });
    }
    result.set(msgKey, reactions);
  }

  return result;
}

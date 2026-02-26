import { eq, and, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import type { ReadState } from '@harmonium/shared';

export async function getReadStates(userId: string, serverIds: bigint[]): Promise<ReadState[]> {
  if (serverIds.length === 0) return [];

  const db = getDb();
  const userIdBigInt = BigInt(userId);

  // Get all channels in the user's servers, then join with read_states
  const rows = await db
    .select({
      channelId: schema.readStates.channelId,
      lastReadMessageId: schema.readStates.lastReadMessageId,
      mentionCount: schema.readStates.mentionCount,
    })
    .from(schema.readStates)
    .innerJoin(schema.channels, eq(schema.readStates.channelId, schema.channels.id))
    .where(
      and(
        eq(schema.readStates.userId, userIdBigInt),
        inArray(schema.channels.serverId, serverIds),
      ),
    );

  return rows.map((row) => ({
    channelId: row.channelId.toString(),
    lastReadMessageId: row.lastReadMessageId?.toString() ?? null,
    mentionCount: Number(row.mentionCount),
  }));
}

export async function markRead(userId: string, channelId: string, messageId: string): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const channelIdBigInt = BigInt(channelId);
  const messageIdBigInt = BigInt(messageId);

  await db
    .insert(schema.readStates)
    .values({
      userId: userIdBigInt,
      channelId: channelIdBigInt,
      lastReadMessageId: messageIdBigInt,
      mentionCount: 0n,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.readStates.userId, schema.readStates.channelId],
      set: {
        lastReadMessageId: messageIdBigInt,
        mentionCount: 0n,
        updatedAt: new Date(),
      },
    });
}

export async function incrementMentionCount(channelId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  // For each mentioned user, upsert their read state and increment mention count
  for (const userId of userIds) {
    const userIdBigInt = BigInt(userId);

    await db
      .insert(schema.readStates)
      .values({
        userId: userIdBigInt,
        channelId: channelIdBigInt,
        lastReadMessageId: null,
        mentionCount: 1n,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.readStates.userId, schema.readStates.channelId],
        set: {
          mentionCount: sql`${schema.readStates.mentionCount} + 1`,
          updatedAt: new Date(),
        },
      });
  }
}

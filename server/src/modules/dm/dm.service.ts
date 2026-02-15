import { eq, and, lt, gt, desc, inArray } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import {
  broadcastDMMessageCreate,
  broadcastDMMessageDelete,
} from '../../ws/handlers/dm.handler.js';
import type { DMMessage, DMChannelWithUser } from '@harmonium/shared';
import type { SendDMMessage, DMMessagesQuery } from './dm.schemas.js';

// ===== Helpers =====

function userToPublic(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id.toString(),
    username: user.username,
    discriminator: user.discriminator,
    avatarUrl: user.avatarUrl,
    aboutMe: user.aboutMe,
    status: user.status as 'online' | 'idle' | 'dnd' | 'offline',
    customStatus: user.customStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function dmMessageToResponse(
  row: typeof schema.dmMessages.$inferSelect,
  user?: typeof schema.users.$inferSelect | null,
): DMMessage {
  return {
    id: row.id.toString(),
    dmChannelId: row.dmChannelId.toString(),
    authorId: row.authorId.toString(),
    content: row.isDeleted ? null : row.content,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt.toISOString(),
    author: user ? userToPublic(user) : undefined,
  };
}

/** Get participant user IDs for a DM channel */
async function getParticipantIds(dmChannelId: bigint): Promise<string[]> {
  const db = getDb();
  const members = await db
    .select({ userId: schema.dmChannelMembers.userId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.dmChannelId, dmChannelId));
  return members.map((m) => m.userId.toString());
}

/** Verify the user is a participant and return participant IDs */
async function requireParticipant(dmChannelId: string, userId: string): Promise<string[]> {
  const participantIds = await getParticipantIds(BigInt(dmChannelId));
  if (!participantIds.includes(userId)) {
    throw new ForbiddenError('You are not a participant in this DM channel');
  }
  return participantIds;
}

// ===== Public API =====

/** Create a new DM channel or return existing one between two users */
export async function createOrGetDMChannel(userId: string, recipientId: string) {
  if (userId === recipientId) {
    throw new ForbiddenError('Cannot create a DM with yourself');
  }

  const db = getDb();

  // Check if a DM channel already exists between these two users
  const userChannels = await db
    .select({ dmChannelId: schema.dmChannelMembers.dmChannelId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.userId, BigInt(userId)));

  const recipientChannels = await db
    .select({ dmChannelId: schema.dmChannelMembers.dmChannelId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.userId, BigInt(recipientId)));

  const userChannelIds = new Set(userChannels.map((c) => c.dmChannelId.toString()));
  const existing = recipientChannels.find((c) => userChannelIds.has(c.dmChannelId.toString()));

  if (existing) {
    const participantIds = await getParticipantIds(existing.dmChannelId);
    const channel = await db.query.dmChannels.findFirst({
      where: eq(schema.dmChannels.id, existing.dmChannelId),
    });
    return {
      id: existing.dmChannelId.toString(),
      participants: participantIds,
      createdAt: channel!.createdAt.toISOString(),
      updatedAt: channel!.updatedAt.toISOString(),
    };
  }

  // Verify recipient exists
  const recipient = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(recipientId)),
  });
  if (!recipient) {
    throw new NotFoundError('User not found');
  }

  // Create new DM channel
  const channelId = generateId();
  const [channel] = await db.insert(schema.dmChannels).values({
    id: channelId,
  }).returning();

  // Add both participants
  await db.insert(schema.dmChannelMembers).values([
    { dmChannelId: channelId, userId: BigInt(userId) },
    { dmChannelId: channelId, userId: BigInt(recipientId) },
  ]);

  return {
    id: channelId.toString(),
    participants: [userId, recipientId],
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

/** List all DM channels for a user, with the other participant's info and last message */
export async function getDMChannels(userId: string): Promise<DMChannelWithUser[]> {
  const db = getDb();

  // Get all DM channel IDs for this user
  const memberRows = await db
    .select({ dmChannelId: schema.dmChannelMembers.dmChannelId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.userId, BigInt(userId)));

  if (memberRows.length === 0) return [];

  const channelIds = memberRows.map((r) => r.dmChannelId);

  // Get the other participant for each channel
  const otherMembers = await db
    .select({
      dmChannelId: schema.dmChannelMembers.dmChannelId,
      userId: schema.dmChannelMembers.userId,
    })
    .from(schema.dmChannelMembers)
    .where(
      and(
        inArray(schema.dmChannelMembers.dmChannelId, channelIds),
        // We want all members, then filter in code
      ),
    );

  // Group by channel, find the "other" user
  const channelOtherUser = new Map<string, bigint>();
  for (const m of otherMembers) {
    if (m.userId.toString() !== userId) {
      channelOtherUser.set(m.dmChannelId.toString(), m.userId);
    }
  }

  // Fetch all other users
  const otherUserIds = [...new Set(channelOtherUser.values())];
  if (otherUserIds.length === 0) return [];

  const users = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, otherUserIds));

  const userMap = new Map(users.map((u) => [u.id.toString(), u]));

  // Fetch last message for each channel
  const results: DMChannelWithUser[] = [];

  for (const channelId of channelIds) {
    const chId = channelId.toString();
    const otherUserId = channelOtherUser.get(chId);
    if (!otherUserId) continue;

    const otherUser = userMap.get(otherUserId.toString());
    if (!otherUser) continue;

    // Get the most recent non-deleted message
    const [lastMsg] = await db
      .select()
      .from(schema.dmMessages)
      .where(
        and(
          eq(schema.dmMessages.dmChannelId, channelId),
          eq(schema.dmMessages.isDeleted, false),
        ),
      )
      .orderBy(desc(schema.dmMessages.id))
      .limit(1);

    results.push({
      id: chId,
      user: userToPublic(otherUser),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id.toString(),
            channelId: chId,
            authorId: lastMsg.authorId.toString(),
            content: lastMsg.content,
            editedAt: null,
            isDeleted: false,
            createdAt: lastMsg.createdAt.toISOString(),
          }
        : undefined,
      unreadCount: 0,
    });
  }

  // Sort by last message time (most recent first), channels without messages last
  results.sort((a, b) => {
    if (!a.lastMessage && !b.lastMessage) return 0;
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt);
  });

  return results;
}

/** Get paginated messages for a DM channel */
export async function getDMMessages(
  dmChannelId: string,
  userId: string,
  query: DMMessagesQuery,
): Promise<DMMessage[]> {
  await requireParticipant(dmChannelId, userId);

  const db = getDb();
  const conditions = [eq(schema.dmMessages.dmChannelId, BigInt(dmChannelId))];

  if (query.before) {
    conditions.push(lt(schema.dmMessages.id, BigInt(query.before)));
  }
  if (query.after) {
    conditions.push(gt(schema.dmMessages.id, BigInt(query.after)));
  }

  const rows = await db
    .select()
    .from(schema.dmMessages)
    .where(and(...conditions))
    .orderBy(desc(schema.dmMessages.id))
    .limit(query.limit);

  // Fetch authors
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = authorIds.length > 0
    ? await db.select().from(schema.users).where(inArray(schema.users.id, authorIds))
    : [];
  const authorMap = new Map(authors.map((u) => [u.id.toString(), u]));

  return rows
    .map((row) => dmMessageToResponse(row, authorMap.get(row.authorId.toString())))
    .reverse(); // Return in chronological order
}

/** Send a message in a DM channel */
export async function createDMMessage(
  dmChannelId: string,
  authorId: string,
  input: SendDMMessage,
): Promise<{ message: DMMessage; participantIds: string[] }> {
  const participantIds = await requireParticipant(dmChannelId, authorId);

  const db = getDb();
  const messageId = generateId();

  const [row] = await db.insert(schema.dmMessages).values({
    id: messageId,
    dmChannelId: BigInt(dmChannelId),
    authorId: BigInt(authorId),
    content: input.content,
  }).returning();

  // Update channel timestamp
  await db.update(schema.dmChannels)
    .set({ updatedAt: new Date() })
    .where(eq(schema.dmChannels.id, BigInt(dmChannelId)));

  // Fetch author info
  const author = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(authorId)),
  });

  const message = dmMessageToResponse(row, author);

  // Broadcast to all participants
  const pubsub = getPubSubManager();
  broadcastDMMessageCreate(pubsub, participantIds, dmChannelId, message);

  return { message, participantIds };
}

/** Soft-delete a DM message (author only) */
export async function deleteDMMessage(
  dmChannelId: string,
  messageId: string,
  userId: string,
): Promise<void> {
  const participantIds = await requireParticipant(dmChannelId, userId);

  const db = getDb();
  const message = await db.query.dmMessages.findFirst({
    where: and(
      eq(schema.dmMessages.id, BigInt(messageId)),
      eq(schema.dmMessages.dmChannelId, BigInt(dmChannelId)),
    ),
  });

  if (!message) {
    throw new NotFoundError('Message not found');
  }

  if (message.authorId.toString() !== userId) {
    throw new ForbiddenError('You can only delete your own messages');
  }

  await db.update(schema.dmMessages)
    .set({ isDeleted: true })
    .where(eq(schema.dmMessages.id, BigInt(messageId)));

  // Broadcast deletion
  const pubsub = getPubSubManager();
  broadcastDMMessageDelete(pubsub, participantIds, dmChannelId, messageId);
}

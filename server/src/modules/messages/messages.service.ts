import { eq, and, lt, gt, desc, asc, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import { computeChannelPermissions } from '../../utils/permissions.js';
import { Permission, hasPermission } from '@harmonium/shared';
import {
  broadcastMessageCreate,
  broadcastMessageUpdate,
  broadcastMessageDelete,
  broadcastMessagePin,
  broadcastMessageUnpin,
} from '../../ws/handlers/message.handler.js';
import { getReactionsForMessages } from './reactions.service.js';
import { incrementMentionCount } from '../read-states/read-states.service.js';
import { fetchAndStoreEmbeds, getEmbedsForMessages } from '../embeds/embeds.service.js';
import type { CreateMessageInput, UpdateMessageInput, MessagesQuery } from './messages.schemas.js';
import type { Message, Attachment, Reaction, Embed } from '@harmonium/shared';
import type { StorageProvider } from '../../storage/local.js';

// ===== Types =====

export interface AttachmentInput {
  filename: string;
  buffer: Buffer;
  contentType: string;
  sizeBytes: number;
}

// ===== Helpers =====

interface MessageRow {
  message: typeof schema.messages.$inferSelect;
  user: typeof schema.users.$inferSelect | null;
}

function attachmentToResponse(row: typeof schema.attachments.$inferSelect): Attachment {
  return {
    id: row.id.toString(),
    messageId: row.messageId.toString(),
    filename: row.filename,
    url: row.url,
    contentType: row.contentType ?? null,
    sizeBytes: row.sizeBytes,
    width: row.width ?? null,
    height: row.height ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function messageToResponse(
  row: MessageRow,
  attachmentRows?: (typeof schema.attachments.$inferSelect)[],
  replyToRow?: MessageRow | null,
  replyToAttachments?: (typeof schema.attachments.$inferSelect)[],
  reactions?: Reaction[],
  embeds?: Embed[],
): Message {
  const { message, user } = row;
  let replyTo: Message | null = null;
  if (replyToRow) {
    replyTo = messageToResponse(replyToRow, replyToAttachments);
  }

  return {
    id: message.id.toString(),
    channelId: message.channelId.toString(),
    authorId: message.authorId.toString(),
    content: message.isDeleted ? null : message.content,
    editedAt: message.editedAt?.toISOString() ?? null,
    isDeleted: message.isDeleted,
    isPinned: message.isPinned,
    pinnedAt: message.pinnedAt?.toISOString() ?? null,
    pinnedBy: message.pinnedBy?.toString() ?? null,
    replyToId: message.replyToId?.toString() ?? null,
    replyTo,
    createdAt: message.createdAt.toISOString(),
    author: user
      ? {
          id: user.id.toString(),
          username: user.username,
          discriminator: user.discriminator,
          avatarUrl: user.avatarUrl,
          aboutMe: user.aboutMe,
          status: user.status as 'online' | 'idle' | 'dnd' | 'offline',
          customStatus: user.customStatus,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }
      : undefined,
    attachments: attachmentRows ? attachmentRows.map(attachmentToResponse) : [],
    reactions: reactions ?? [],
    embeds: embeds ?? [],
    webhookId: message.webhookId?.toString() ?? null,
    webhookName: message.webhookName ?? null,
    webhookAvatarUrl: message.webhookAvatarUrl ?? null,
  };
}

async function fetchAttachmentsForMessages(messageIds: bigint[]): Promise<Map<string, (typeof schema.attachments.$inferSelect)[]>> {
  if (messageIds.length === 0) return new Map();

  const db = getDb();
  const allAttachments = await db
    .select()
    .from(schema.attachments)
    .where(inArray(schema.attachments.messageId, messageIds));

  const map = new Map<string, (typeof schema.attachments.$inferSelect)[]>();
  for (const att of allAttachments) {
    const key = att.messageId.toString();
    const existing = map.get(key);
    if (existing) {
      existing.push(att);
    } else {
      map.set(key, [att]);
    }
  }
  return map;
}

async function fetchReplyMessages(replyToIds: bigint[]): Promise<Map<string, { row: MessageRow; attachments: (typeof schema.attachments.$inferSelect)[] }>> {
  if (replyToIds.length === 0) return new Map();

  const db = getDb();
  const rows = await db
    .select({
      message: schema.messages,
      user: schema.users,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
    .where(inArray(schema.messages.id, replyToIds));

  const attachmentsMap = await fetchAttachmentsForMessages(replyToIds);

  const map = new Map<string, { row: MessageRow; attachments: (typeof schema.attachments.$inferSelect)[] }>();
  for (const row of rows) {
    const key = row.message.id.toString();
    map.set(key, { row, attachments: attachmentsMap.get(key) ?? [] });
  }
  return map;
}

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

// ===== Service Functions =====

export async function createMessage(
  channelId: string,
  authorId: string,
  input: CreateMessageInput,
  attachmentInputs: AttachmentInput[] = [],
  storage?: StorageProvider,
): Promise<Message> {
  const db = getDb();

  // Look up channel to get serverId (may be null for DM channels)
  const channel = await getChannelWithServer(channelId);
  const serverId = channel.serverId?.toString() ?? null;

  // Validate replyToId if provided
  let replyToIdBigInt: bigint | undefined;
  if (input.replyToId) {
    replyToIdBigInt = BigInt(input.replyToId);
    const replyTarget = await db.query.messages.findFirst({
      where: eq(schema.messages.id, replyToIdBigInt),
    });
    if (!replyTarget) {
      throw new ValidationError('Referenced message not found');
    }
    if (replyTarget.channelId.toString() !== channelId) {
      throw new ValidationError('Cannot reply to a message in a different channel');
    }
  }

  // Generate snowflake ID
  const messageId = generateId();

  // Insert message
  await db.insert(schema.messages).values({
    id: messageId,
    channelId: BigInt(channelId),
    authorId: BigInt(authorId),
    content: input.content ?? null,
    replyToId: replyToIdBigInt ?? null,
  });

  // Save attachments
  const attachmentRows: (typeof schema.attachments.$inferSelect)[] = [];
  if (attachmentInputs.length > 0 && storage) {
    for (const file of attachmentInputs) {
      const attachmentId = generateId();
      const relativePath = `attachments/${messageId.toString()}/${file.filename}`;
      const url = await storage.save(relativePath, file.buffer);

      const values = {
        id: attachmentId,
        messageId,
        filename: file.filename,
        url,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
      };

      await db.insert(schema.attachments).values(values);

      // Query back the inserted row so we have the full record with createdAt
      const inserted = await db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, attachmentId))
        .limit(1);

      if (inserted[0]) {
        attachmentRows.push(inserted[0]);
      }
    }
  }

  // Query back with author data
  const rows = await db
    .select({
      message: schema.messages,
      user: schema.users,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
    .where(eq(schema.messages.id, messageId))
    .limit(1);

  if (!rows[0]) {
    throw new NotFoundError('Message not found after creation');
  }

  // Fetch replyTo data if applicable
  let replyToRow: MessageRow | null = null;
  let replyToAttachments: (typeof schema.attachments.$inferSelect)[] = [];
  if (replyToIdBigInt) {
    const replyData = await fetchReplyMessages([replyToIdBigInt]);
    const data = replyData.get(replyToIdBigInt.toString());
    if (data) {
      replyToRow = data.row;
      replyToAttachments = data.attachments;
    }
  }

  const message = messageToResponse(rows[0], attachmentRows, replyToRow, replyToAttachments);

  // If this channel is a thread, auto-add sender as thread member and update thread metadata
  if (channel.isThread) {
    await db
      .insert(schema.threadMembers)
      .values({
        channelId: BigInt(channelId),
        userId: BigInt(authorId),
      })
      .onConflictDoNothing();

    await db
      .update(schema.channels)
      .set({
        lastMessageAt: new Date(),
        messageCount: sql`${schema.channels.messageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.channels.id, BigInt(channelId)));
  }

  // Publish MESSAGE_CREATE event via pub/sub
  const pubsub = getPubSubManager();
  if (serverId) {
    broadcastMessageCreate(pubsub, serverId, message);
  } else {
    // DM channel: broadcast to all DM members via user-scoped pub/sub
    const dmMembers = await db
      .select({ userId: schema.dmChannelMembers.userId })
      .from(schema.dmChannelMembers)
      .where(eq(schema.dmChannelMembers.channelId, BigInt(channelId)));

    for (const member of dmMembers) {
      const memberUserId = member.userId.toString();
      await pubsub.publishToUser(memberUserId, { op: 'MESSAGE_CREATE', d: { message } });
    }

    // Reopen the DM for all members who may have closed it
    await db
      .update(schema.dmChannelMembers)
      .set({ isOpen: true })
      .where(eq(schema.dmChannelMembers.channelId, BigInt(channelId)));
  }

  // Parse mentions and increment mention counts
  if (input.content) {
    const mentionPattern = /<@(\d+)>/g;
    const mentionedUserIds: string[] = [];
    let match;
    while ((match = mentionPattern.exec(input.content)) !== null) {
      const mentionedId = match[1];
      // Don't count self-mentions
      if (mentionedId !== authorId && !mentionedUserIds.includes(mentionedId)) {
        mentionedUserIds.push(mentionedId);
      }
    }
    if (mentionedUserIds.length > 0) {
      await incrementMentionCount(channelId, mentionedUserIds);
    }
  }

  // Fire-and-forget embed fetching
  if (input.content) {
    fetchAndStoreEmbeds(messageId, input.content, channelId, serverId).catch(() => {
      // Silently ignore embed fetch failures
    });
  }

  return message;
}

export async function getMessages(
  channelId: string,
  query: MessagesQuery,
): Promise<Message[]> {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);
  const limit = query.limit;

  let rows: MessageRow[];

  if (query.before) {
    // Fetch messages before cursor (older messages)
    rows = await db
      .select({
        message: schema.messages,
        user: schema.users,
      })
      .from(schema.messages)
      .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
      .where(
        and(
          eq(schema.messages.channelId, channelIdBigInt),
          lt(schema.messages.id, BigInt(query.before)),
        ),
      )
      .orderBy(desc(schema.messages.id))
      .limit(limit);

    // Reverse to return in chronological order (oldest first)
    rows.reverse();
  } else if (query.after) {
    // Fetch messages after cursor (newer messages)
    rows = await db
      .select({
        message: schema.messages,
        user: schema.users,
      })
      .from(schema.messages)
      .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
      .where(
        and(
          eq(schema.messages.channelId, channelIdBigInt),
          gt(schema.messages.id, BigInt(query.after)),
        ),
      )
      .orderBy(asc(schema.messages.id))
      .limit(limit);
  } else {
    // Default: newest first, then reverse
    rows = await db
      .select({
        message: schema.messages,
        user: schema.users,
      })
      .from(schema.messages)
      .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
      .where(eq(schema.messages.channelId, channelIdBigInt))
      .orderBy(desc(schema.messages.id))
      .limit(limit);

    // Reverse to return in chronological order (oldest first)
    rows.reverse();
  }

  // Fetch attachments for all messages in one query
  const messageIds = rows.map((r) => r.message.id);
  const attachmentsMap = await fetchAttachmentsForMessages(messageIds);

  // Batch-fetch reactions
  const reactionsMap = await getReactionsForMessages(messageIds);

  // Batch-fetch embeds
  const embedsMap = await getEmbedsForMessages(messageIds);

  // Batch-fetch replyTo messages
  const replyToIds = rows
    .map((r) => r.message.replyToId)
    .filter((id): id is bigint => id !== null);
  const replyToMap = await fetchReplyMessages(replyToIds);

  return rows.map((row) => {
    const msgKey = row.message.id.toString();
    const msgAttachments = attachmentsMap.get(msgKey) ?? [];
    const replyToId = row.message.replyToId?.toString();
    const replyData = replyToId ? replyToMap.get(replyToId) : undefined;
    return messageToResponse(
      row,
      msgAttachments,
      replyData?.row ?? null,
      replyData?.attachments,
      reactionsMap.get(msgKey),
      embedsMap.get(msgKey),
    );
  });
}

export async function updateMessage(
  messageId: string,
  userId: string,
  input: UpdateMessageInput,
): Promise<Message> {
  const db = getDb();
  const messageIdBigInt = BigInt(messageId);

  // Fetch existing message
  const existing = await db.query.messages.findFirst({
    where: eq(schema.messages.id, messageIdBigInt),
  });

  if (!existing) {
    throw new NotFoundError('Message not found');
  }

  if (existing.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  // Verify author is the requesting user
  if (existing.authorId.toString() !== userId) {
    throw new ForbiddenError('You can only edit your own messages');
  }

  // Update content and set editedAt
  await db
    .update(schema.messages)
    .set({
      content: input.content,
      editedAt: new Date(),
    })
    .where(eq(schema.messages.id, messageIdBigInt));

  // Query back with author data
  const rows = await db
    .select({
      message: schema.messages,
      user: schema.users,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
    .where(eq(schema.messages.id, messageIdBigInt))
    .limit(1);

  if (!rows[0]) {
    throw new NotFoundError('Message not found after update');
  }

  // Fetch attachments for the updated message
  const msgAttachments = await fetchAttachmentsForMessages([messageIdBigInt]);

  // Fetch replyTo data if applicable
  let replyToRow: MessageRow | null = null;
  let replyToAttachments: (typeof schema.attachments.$inferSelect)[] = [];
  if (rows[0].message.replyToId) {
    const replyData = await fetchReplyMessages([rows[0].message.replyToId]);
    const data = replyData.get(rows[0].message.replyToId.toString());
    if (data) {
      replyToRow = data.row;
      replyToAttachments = data.attachments;
    }
  }

  const message = messageToResponse(rows[0], msgAttachments.get(messageId) ?? [], replyToRow, replyToAttachments);

  // Get serverId for broadcasting
  const channel = await getChannelWithServer(existing.channelId.toString());
  const pubsub = getPubSubManager();

  if (channel.serverId) {
    const serverId = channel.serverId.toString();
    broadcastMessageUpdate(pubsub, serverId, message);
  } else {
    // DM channel: broadcast to all DM members via user-scoped pub/sub
    const dmMembers = await db
      .select({ userId: schema.dmChannelMembers.userId })
      .from(schema.dmChannelMembers)
      .where(eq(schema.dmChannelMembers.channelId, BigInt(existing.channelId.toString())));

    for (const member of dmMembers) {
      await pubsub.publishToUser(member.userId.toString(), { op: 'MESSAGE_UPDATE', d: { message } });
    }
  }

  return message;
}

export async function deleteMessage(
  messageId: string,
  channelId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  const messageIdBigInt = BigInt(messageId);

  // Fetch existing message
  const existing = await db.query.messages.findFirst({
    where: eq(schema.messages.id, messageIdBigInt),
  });

  if (!existing) {
    throw new NotFoundError('Message not found');
  }

  if (existing.isDeleted) {
    throw new NotFoundError('Message not found');
  }

  // Verify channel matches
  if (existing.channelId.toString() !== channelId) {
    throw new NotFoundError('Message not found');
  }

  // Check permissions: author can delete own messages, MANAGE_MESSAGES can delete any
  const isAuthor = existing.authorId.toString() === userId;
  const channel = await getChannelWithServer(channelId);

  if (!isAuthor) {
    if (channel.isDm || channel.serverId === null) {
      // In DMs, only the author can delete their own messages
      throw new ForbiddenError('You can only delete your own messages in DMs');
    }

    // Check if user has MANAGE_MESSAGES permission
    const serverId = channel.serverId.toString();
    const permissions = await computeChannelPermissions(db, serverId, channelId, userId);

    if (!hasPermission(permissions, Permission.MANAGE_MESSAGES)) {
      throw new ForbiddenError('You do not have permission to delete this message');
    }
  }

  // Soft delete: set isDeleted = true, content = null
  await db
    .update(schema.messages)
    .set({
      isDeleted: true,
      content: null,
    })
    .where(eq(schema.messages.id, messageIdBigInt));

  // Publish MESSAGE_DELETE event
  const pubsub = getPubSubManager();

  if (channel.serverId) {
    const serverId = channel.serverId.toString();
    broadcastMessageDelete(pubsub, serverId, messageId, channelId);
  } else {
    // DM channel: broadcast to all DM members
    const dmMembers = await db
      .select({ userId: schema.dmChannelMembers.userId })
      .from(schema.dmChannelMembers)
      .where(eq(schema.dmChannelMembers.channelId, BigInt(channelId)));

    for (const member of dmMembers) {
      await pubsub.publishToUser(member.userId.toString(), {
        op: 'MESSAGE_DELETE',
        d: { id: messageId, channelId },
      });
    }
  }
}

const MAX_PINS_PER_CHANNEL = 50;

export async function pinMessage(
  channelId: string,
  messageId: string,
  userId: string,
): Promise<Message> {
  const db = getDb();
  const messageIdBigInt = BigInt(messageId);

  // Fetch existing message
  const existing = await db.query.messages.findFirst({
    where: eq(schema.messages.id, messageIdBigInt),
  });

  if (!existing) {
    throw new NotFoundError('Message not found');
  }

  if (existing.isDeleted) {
    throw new ValidationError('Cannot pin a deleted message');
  }

  if (existing.channelId.toString() !== channelId) {
    throw new NotFoundError('Message not found in this channel');
  }

  // If already pinned, return the message as-is
  if (existing.isPinned) {
    const rows = await db
      .select({ message: schema.messages, user: schema.users })
      .from(schema.messages)
      .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
      .where(eq(schema.messages.id, messageIdBigInt))
      .limit(1);

    if (!rows[0]) throw new NotFoundError('Message not found');

    const msgAttachments = await fetchAttachmentsForMessages([messageIdBigInt]);
    return messageToResponse(rows[0], msgAttachments.get(messageId) ?? []);
  }

  // Check pin count for this channel
  const channelIdBigInt = BigInt(channelId);
  const pinnedCount = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.channelId, channelIdBigInt),
        eq(schema.messages.isPinned, true),
      ),
    );

  if (pinnedCount.length >= MAX_PINS_PER_CHANNEL) {
    throw new ValidationError(`Cannot pin more than ${MAX_PINS_PER_CHANNEL} messages per channel`);
  }

  // Pin the message
  await db
    .update(schema.messages)
    .set({
      isPinned: true,
      pinnedAt: new Date(),
      pinnedBy: BigInt(userId),
    })
    .where(eq(schema.messages.id, messageIdBigInt));

  // Query back with author data
  const rows = await db
    .select({ message: schema.messages, user: schema.users })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
    .where(eq(schema.messages.id, messageIdBigInt))
    .limit(1);

  if (!rows[0]) throw new NotFoundError('Message not found after pin');

  const msgAttachments = await fetchAttachmentsForMessages([messageIdBigInt]);
  const message = messageToResponse(rows[0], msgAttachments.get(messageId) ?? []);

  // Broadcast
  const channel = await getChannelWithServer(channelId);
  const serverId = channel.serverId.toString();
  const pubsub = getPubSubManager();
  broadcastMessagePin(pubsub, serverId, channelId, message);

  return message;
}

export async function unpinMessage(
  channelId: string,
  messageId: string,
): Promise<void> {
  const db = getDb();
  const messageIdBigInt = BigInt(messageId);

  // Fetch existing message
  const existing = await db.query.messages.findFirst({
    where: eq(schema.messages.id, messageIdBigInt),
  });

  if (!existing) {
    throw new NotFoundError('Message not found');
  }

  if (existing.channelId.toString() !== channelId) {
    throw new NotFoundError('Message not found in this channel');
  }

  if (!existing.isPinned) {
    throw new ValidationError('Message is not pinned');
  }

  // Unpin the message
  await db
    .update(schema.messages)
    .set({
      isPinned: false,
      pinnedAt: null,
      pinnedBy: null,
    })
    .where(eq(schema.messages.id, messageIdBigInt));

  // Broadcast
  const channel = await getChannelWithServer(channelId);
  const serverId = channel.serverId.toString();
  const pubsub = getPubSubManager();
  broadcastMessageUnpin(pubsub, serverId, channelId, messageId);
}

export async function getPinnedMessages(channelId: string): Promise<Message[]> {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  const rows = await db
    .select({ message: schema.messages, user: schema.users })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
    .where(
      and(
        eq(schema.messages.channelId, channelIdBigInt),
        eq(schema.messages.isPinned, true),
      ),
    )
    .orderBy(desc(schema.messages.pinnedAt));

  const messageIds = rows.map((r) => r.message.id);
  const attachmentsMap = await fetchAttachmentsForMessages(messageIds);
  const reactionsMap = await getReactionsForMessages(messageIds);

  return rows.map((row) => {
    const msgKey = row.message.id.toString();
    return messageToResponse(
      row,
      attachmentsMap.get(msgKey) ?? [],
      null,
      undefined,
      reactionsMap.get(msgKey),
    );
  });
}

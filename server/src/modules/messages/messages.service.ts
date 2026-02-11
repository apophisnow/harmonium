import { eq, and, lt, gt, desc, asc, inArray } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import { computeChannelPermissions } from '../../utils/permissions.js';
import { Permission, hasPermission } from '@harmonium/shared';
import {
  broadcastMessageCreate,
  broadcastMessageUpdate,
  broadcastMessageDelete,
} from '../../ws/handlers/message.handler.js';
import type { CreateMessageInput, UpdateMessageInput, MessagesQuery } from './messages.schemas.js';
import type { Message, Attachment } from '@harmonium/shared';
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
    createdAt: row.createdAt.toISOString(),
  };
}

function messageToResponse(row: MessageRow, attachmentRows?: (typeof schema.attachments.$inferSelect)[]): Message {
  const { message, user } = row;
  return {
    id: message.id.toString(),
    channelId: message.channelId.toString(),
    authorId: message.authorId.toString(),
    content: message.isDeleted ? null : message.content,
    editedAt: message.editedAt?.toISOString() ?? null,
    isDeleted: message.isDeleted,
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

  // Look up channel to get serverId
  const channel = await getChannelWithServer(channelId);
  const serverId = channel.serverId.toString();

  // Generate snowflake ID
  const messageId = generateId();

  // Insert message
  await db.insert(schema.messages).values({
    id: messageId,
    channelId: BigInt(channelId),
    authorId: BigInt(authorId),
    content: input.content ?? null,
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

  const message = messageToResponse(rows[0], attachmentRows);

  // Publish MESSAGE_CREATE event via pub/sub
  const pubsub = getPubSubManager();
  broadcastMessageCreate(pubsub, serverId, message);

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

  return rows.map((row) => {
    const msgAttachments = attachmentsMap.get(row.message.id.toString()) ?? [];
    return messageToResponse(row, msgAttachments);
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
  const message = messageToResponse(rows[0], msgAttachments.get(messageId) ?? []);

  // Get serverId for broadcasting
  const channel = await getChannelWithServer(existing.channelId.toString());
  const serverId = channel.serverId.toString();

  // Publish MESSAGE_UPDATE event
  const pubsub = getPubSubManager();
  broadcastMessageUpdate(pubsub, serverId, message);

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

  if (!isAuthor) {
    // Check if user has MANAGE_MESSAGES permission
    const channel = await getChannelWithServer(channelId);
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

  // Get serverId for broadcasting
  const channel = await getChannelWithServer(channelId);
  const serverId = channel.serverId.toString();

  // Publish MESSAGE_DELETE event
  const pubsub = getPubSubManager();
  broadcastMessageDelete(pubsub, serverId, messageId, channelId);
}

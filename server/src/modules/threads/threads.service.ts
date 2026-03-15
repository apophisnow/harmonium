import { eq, and, desc } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import { channelToResponse, requireMembership } from '../channels/channels.service.js';
import type { CreateThreadInput } from './threads.schemas.js';

// ===== Helpers =====

function normalizeThreadName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ===== Service Functions =====

export async function createThread(
  channelId: string,
  userId: string,
  input: CreateThreadInput,
) {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  // Look up parent channel
  const parentChannel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!parentChannel) {
    throw new NotFoundError('Channel not found');
  }

  if (parentChannel.isThread) {
    throw new ForbiddenError('Cannot create a thread within a thread');
  }

  const serverId = parentChannel.serverId!.toString();
  await requireMembership(serverId, userId);

  // Verify the origin message exists in this channel
  const messageIdBigInt = BigInt(input.messageId);
  const message = await db.query.messages.findFirst({
    where: eq(schema.messages.id, messageIdBigInt),
  });

  if (!message) {
    throw new NotFoundError('Message not found');
  }

  if (message.channelId.toString() !== channelId) {
    throw new ForbiddenError('Message does not belong to this channel');
  }

  // Check if a thread already exists for this message
  const existingThread = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.originMessageId, messageIdBigInt),
      eq(schema.channels.isThread, true),
    ),
  });

  if (existingThread) {
    throw new ConflictError('A thread already exists for this message');
  }

  const threadId = generateId();
  const normalizedName = normalizeThreadName(input.name);

  const [thread] = await db
    .insert(schema.channels)
    .values({
      id: threadId,
      serverId: parentChannel.serverId,
      name: normalizedName,
      type: 'text',
      position: 0,
      isThread: true,
      parentChannelId: channelIdBigInt,
      originMessageId: messageIdBigInt,
    })
    .returning();

  // Auto-add creator as thread member
  await db
    .insert(schema.threadMembers)
    .values({
      channelId: threadId,
      userId: BigInt(userId),
    })
    .onConflictDoNothing();

  const response = channelToResponse(thread);

  // Broadcast THREAD_CREATE
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'THREAD_CREATE' as const,
    d: { thread: response },
  });

  return response;
}

export async function getThreads(channelId: string, userId: string) {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  // Look up parent channel
  const parentChannel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!parentChannel) {
    throw new NotFoundError('Channel not found');
  }

  await requireMembership(parentChannel.serverId!.toString(), userId);

  const threads = await db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.parentChannelId, channelIdBigInt),
        eq(schema.channels.isThread, true),
      ),
    )
    .orderBy(desc(schema.channels.lastMessageAt));

  return threads.map((t) => ({
    id: t.id.toString(),
    name: t.name,
    parentChannelId: t.parentChannelId?.toString() ?? null,
    originMessageId: t.originMessageId?.toString() ?? null,
    threadArchived: t.threadArchived,
    lastMessageAt: t.lastMessageAt?.toISOString() ?? null,
    messageCount: t.messageCount,
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function archiveThread(threadId: string, userId: string) {
  const db = getDb();
  const threadIdBigInt = BigInt(threadId);

  const thread = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, threadIdBigInt),
      eq(schema.channels.isThread, true),
    ),
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  const serverId = thread.serverId!.toString();
  await requireMembership(serverId, userId);

  const [updated] = await db
    .update(schema.channels)
    .set({
      threadArchived: true,
      threadArchivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.channels.id, threadIdBigInt))
    .returning();

  const response = channelToResponse(updated);

  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'THREAD_UPDATE' as const,
    d: { thread: response },
  });

  return response;
}

export async function unarchiveThread(threadId: string, userId: string) {
  const db = getDb();
  const threadIdBigInt = BigInt(threadId);

  const thread = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, threadIdBigInt),
      eq(schema.channels.isThread, true),
    ),
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  const serverId = thread.serverId!.toString();
  await requireMembership(serverId, userId);

  const [updated] = await db
    .update(schema.channels)
    .set({
      threadArchived: false,
      threadArchivedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.channels.id, threadIdBigInt))
    .returning();

  const response = channelToResponse(updated);

  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'THREAD_UPDATE' as const,
    d: { thread: response },
  });

  return response;
}

export async function joinThread(threadId: string, userId: string) {
  const db = getDb();
  const threadIdBigInt = BigInt(threadId);

  const thread = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, threadIdBigInt),
      eq(schema.channels.isThread, true),
    ),
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  await requireMembership(thread.serverId!.toString(), userId);

  await db
    .insert(schema.threadMembers)
    .values({
      channelId: threadIdBigInt,
      userId: BigInt(userId),
    })
    .onConflictDoNothing();
}

export async function leaveThread(threadId: string, userId: string) {
  const db = getDb();
  const threadIdBigInt = BigInt(threadId);

  const thread = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, threadIdBigInt),
      eq(schema.channels.isThread, true),
    ),
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  await db
    .delete(schema.threadMembers)
    .where(
      and(
        eq(schema.threadMembers.channelId, threadIdBigInt),
        eq(schema.threadMembers.userId, BigInt(userId)),
      ),
    );
}

export async function deleteThread(threadId: string, userId: string) {
  const db = getDb();
  const threadIdBigInt = BigInt(threadId);

  const thread = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, threadIdBigInt),
      eq(schema.channels.isThread, true),
    ),
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  const serverId = thread.serverId!.toString();
  await requireMembership(serverId, userId);

  const parentChannelId = thread.parentChannelId?.toString() ?? '';

  await db.delete(schema.channels).where(eq(schema.channels.id, threadIdBigInt));

  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'THREAD_DELETE' as const,
    d: { threadId, serverId, parentChannelId },
  });
}

export async function getThread(threadId: string, userId: string) {
  const db = getDb();
  const threadIdBigInt = BigInt(threadId);

  const thread = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, threadIdBigInt),
      eq(schema.channels.isThread, true),
    ),
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  await requireMembership(thread.serverId!.toString(), userId);

  return channelToResponse(thread);
}

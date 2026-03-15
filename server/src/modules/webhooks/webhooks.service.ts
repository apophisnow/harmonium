import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { hasPermission, Permission } from '@harmonium/shared';
import { getPubSubManager } from '../../ws/pubsub.js';
import { broadcastMessageCreate } from '../../ws/handlers/message.handler.js';
import type { Webhook, WebhookInfo, Message } from '@harmonium/shared';
import type { CreateWebhookInput, UpdateWebhookInput, ExecuteWebhookInput } from './webhooks.schemas.js';

const MAX_WEBHOOKS_PER_SERVER = 10;

function webhookToResponse(row: typeof schema.webhooks.$inferSelect): Webhook {
  return {
    id: row.id.toString(),
    serverId: row.serverId.toString(),
    channelId: row.channelId.toString(),
    name: row.name,
    avatarUrl: row.avatarUrl ?? null,
    token: row.token,
    createdBy: row.createdBy.toString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function webhookToInfo(row: typeof schema.webhooks.$inferSelect): WebhookInfo {
  return {
    id: row.id.toString(),
    serverId: row.serverId.toString(),
    channelId: row.channelId.toString(),
    name: row.name,
    avatarUrl: row.avatarUrl ?? null,
    createdBy: row.createdBy.toString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Compute the effective permissions for a user in a server */
async function getUserServerPermissions(serverId: bigint, userId: bigint): Promise<bigint> {
  const db = getDb();

  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverId),
  });

  if (server && server.ownerId === userId) {
    return ~0n;
  }

  const defaultRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.serverId, serverId),
      eq(schema.roles.isDefault, true),
    ),
  });

  let permissions = defaultRole?.permissions ?? 0n;

  const memberRoleRows = await db
    .select({ role: schema.roles })
    .from(schema.memberRoles)
    .innerJoin(schema.roles, eq(schema.memberRoles.roleId, schema.roles.id))
    .where(
      and(
        eq(schema.memberRoles.serverId, serverId),
        eq(schema.memberRoles.userId, userId),
      ),
    );

  for (const row of memberRoleRows) {
    permissions |= row.role.permissions;
  }

  return permissions;
}

export async function createWebhook(
  serverId: string,
  userId: string,
  input: CreateWebhookInput,
): Promise<Webhook> {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Check MANAGE_SERVER permission
  const permissions = await getUserServerPermissions(serverIdBigInt, userIdBigInt);
  if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
    throw new ForbiddenError('You do not have permission to manage webhooks');
  }

  // Verify channel belongs to this server
  const channel = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, BigInt(input.channelId)),
      eq(schema.channels.serverId, serverIdBigInt),
    ),
  });
  if (!channel) {
    throw new NotFoundError('Channel not found in this server');
  }

  // Check max webhooks per server
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.webhooks)
    .where(eq(schema.webhooks.serverId, serverIdBigInt));

  if (countResult.count >= MAX_WEBHOOKS_PER_SERVER) {
    throw new ValidationError(`Maximum of ${MAX_WEBHOOKS_PER_SERVER} webhooks per server`);
  }

  const id = generateId();
  const token = crypto.randomBytes(32).toString('hex');

  const [webhook] = await db
    .insert(schema.webhooks)
    .values({
      id,
      serverId: serverIdBigInt,
      channelId: BigInt(input.channelId),
      name: input.name,
      avatarUrl: input.avatarUrl ?? null,
      token,
      createdBy: userIdBigInt,
    })
    .returning();

  return webhookToResponse(webhook);
}

export async function updateWebhook(
  serverId: string,
  webhookId: string,
  userId: string,
  input: UpdateWebhookInput,
): Promise<WebhookInfo> {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Check MANAGE_SERVER permission
  const permissions = await getUserServerPermissions(serverIdBigInt, userIdBigInt);
  if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
    throw new ForbiddenError('You do not have permission to manage webhooks');
  }

  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(schema.webhooks.id, BigInt(webhookId)),
      eq(schema.webhooks.serverId, serverIdBigInt),
    ),
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  // If channelId is being updated, verify the new channel belongs to this server
  if (input.channelId) {
    const channel = await db.query.channels.findFirst({
      where: and(
        eq(schema.channels.id, BigInt(input.channelId)),
        eq(schema.channels.serverId, serverIdBigInt),
      ),
    });
    if (!channel) {
      throw new NotFoundError('Channel not found in this server');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.channelId !== undefined) updateData.channelId = BigInt(input.channelId);
  if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;

  if (Object.keys(updateData).length === 0) {
    return webhookToInfo(webhook);
  }

  const [updated] = await db
    .update(schema.webhooks)
    .set(updateData)
    .where(eq(schema.webhooks.id, BigInt(webhookId)))
    .returning();

  return webhookToInfo(updated);
}

export async function deleteWebhook(
  serverId: string,
  webhookId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Check MANAGE_SERVER permission
  const permissions = await getUserServerPermissions(serverIdBigInt, userIdBigInt);
  if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
    throw new ForbiddenError('You do not have permission to manage webhooks');
  }

  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(schema.webhooks.id, BigInt(webhookId)),
      eq(schema.webhooks.serverId, serverIdBigInt),
    ),
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  await db.delete(schema.webhooks).where(eq(schema.webhooks.id, BigInt(webhookId)));
}

export async function getWebhooks(
  serverId: string,
  userId: string,
): Promise<WebhookInfo[]> {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Check MANAGE_SERVER permission
  const permissions = await getUserServerPermissions(serverIdBigInt, userIdBigInt);
  if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
    throw new ForbiddenError('You do not have permission to manage webhooks');
  }

  const webhookRows = await db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.serverId, serverIdBigInt));

  return webhookRows.map(webhookToInfo);
}

export async function getWebhookByToken(
  webhookId: string,
  token: string,
): Promise<typeof schema.webhooks.$inferSelect> {
  const db = getDb();

  const webhook = await db.query.webhooks.findFirst({
    where: and(
      eq(schema.webhooks.id, BigInt(webhookId)),
      eq(schema.webhooks.token, token),
    ),
  });

  if (!webhook) {
    throw new NotFoundError('Webhook not found');
  }

  return webhook;
}

export async function executeWebhook(
  webhookId: string,
  token: string,
  input: ExecuteWebhookInput,
): Promise<Message> {
  const db = getDb();

  const webhook = await getWebhookByToken(webhookId, token);

  // Use override name/avatar if provided, otherwise use webhook defaults
  const webhookName = input.username ?? webhook.name;
  const webhookAvatarUrl = input.avatarUrl ?? webhook.avatarUrl;

  // Generate message ID
  const messageId = generateId();

  // Insert message with webhook fields
  await db.insert(schema.messages).values({
    id: messageId,
    channelId: webhook.channelId,
    authorId: webhook.createdBy, // Use the webhook creator as authorId
    content: input.content,
    webhookId: webhook.id,
    webhookName,
    webhookAvatarUrl,
  });

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

  const { message: msg, user } = rows[0];

  const messageResponse: Message = {
    id: msg.id.toString(),
    channelId: msg.channelId.toString(),
    authorId: msg.authorId.toString(),
    content: msg.content,
    editedAt: null,
    isDeleted: false,
    replyToId: null,
    createdAt: msg.createdAt.toISOString(),
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
    attachments: [],
    reactions: [],
    webhookId: msg.webhookId?.toString() ?? null,
    webhookName: msg.webhookName ?? null,
    webhookAvatarUrl: msg.webhookAvatarUrl ?? null,
  };

  // Get serverId for broadcasting
  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, webhook.channelId),
  });

  if (channel) {
    const pubsub = getPubSubManager();
    broadcastMessageCreate(pubsub, channel.serverId.toString(), messageResponse);
  }

  return messageResponse;
}

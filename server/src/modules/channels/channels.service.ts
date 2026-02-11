import { eq, and, sql, isNull, asc } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import { Permission, hasPermission, computeChannelPermissions } from '@harmonium/shared';
import type {
  CreateChannelInput,
  UpdateChannelInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  PermissionOverrideInput,
} from './channels.schemas.js';

// ===== Helpers =====

function normalizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function channelToResponse(channel: typeof schema.channels.$inferSelect) {
  return {
    id: channel.id.toString(),
    serverId: channel.serverId.toString(),
    categoryId: channel.categoryId?.toString() ?? null,
    name: channel.name,
    type: channel.type as 'text' | 'voice',
    topic: channel.topic,
    position: channel.position,
    isPrivate: channel.isPrivate,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

function categoryToResponse(category: typeof schema.channelCategories.$inferSelect) {
  return {
    id: category.id.toString(),
    serverId: category.serverId.toString(),
    name: category.name,
    position: category.position,
    createdAt: category.createdAt.toISOString(),
  };
}

function permissionOverrideToResponse(override: typeof schema.channelPermissionOverrides.$inferSelect) {
  return {
    channelId: override.channelId.toString(),
    targetType: override.targetType,
    targetId: override.targetId.toString(),
    allow: override.allow.toString(),
    deny: override.deny.toString(),
  };
}

// ===== Membership & Permission Checks =====

export async function requireMembership(serverId: string, userId: string): Promise<void> {
  const db = getDb();
  const membership = await db.query.serverMembers.findFirst({
    where: and(
      eq(schema.serverMembers.serverId, BigInt(serverId)),
      eq(schema.serverMembers.userId, BigInt(userId)),
    ),
  });

  if (!membership) {
    throw new ForbiddenError('You are not a member of this server');
  }
}

async function getServerOwnerId(serverId: string): Promise<string> {
  const db = getDb();
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, BigInt(serverId)),
  });
  if (!server) {
    throw new NotFoundError('Server not found');
  }
  return server.ownerId.toString();
}

async function getMemberPermissions(serverId: string, userId: string): Promise<bigint> {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Server owner has all permissions
  const ownerId = await getServerOwnerId(serverId);
  if (ownerId === userId) {
    return ~0n; // All bits set
  }

  // Get all roles for this server
  const allRoles = await db.query.roles.findMany({
    where: eq(schema.roles.serverId, serverIdBigInt),
  });

  // Get the @everyone role (default)
  const everyoneRole = allRoles.find((r) => r.isDefault);
  let permissions = everyoneRole?.permissions ?? 0n;

  // Get member's assigned roles
  const memberRoleRows = await db
    .select({ roleId: schema.memberRoles.roleId })
    .from(schema.memberRoles)
    .where(
      and(
        eq(schema.memberRoles.serverId, serverIdBigInt),
        eq(schema.memberRoles.userId, userIdBigInt),
      ),
    );

  const memberRoleIds = new Set(memberRoleRows.map((r) => r.roleId));

  // Combine permissions from all assigned roles
  for (const role of allRoles) {
    if (memberRoleIds.has(role.id)) {
      permissions |= role.permissions;
    }
  }

  return permissions;
}

async function requirePermission(serverId: string, userId: string, permission: bigint): Promise<void> {
  await requireMembership(serverId, userId);
  const perms = await getMemberPermissions(serverId, userId);
  if (!hasPermission(perms, permission)) {
    throw new ForbiddenError('You do not have permission to perform this action');
  }
}

async function getChannelPermissionsForUser(
  channelId: string,
  serverId: string,
  userId: string,
): Promise<bigint> {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Get base server permissions
  const basePermissions = await getMemberPermissions(serverId, userId);

  // Admin bypasses all channel overrides
  if (hasPermission(basePermissions, Permission.ADMINISTRATOR)) {
    return basePermissions;
  }

  // Get all channel permission overrides
  const overrides = await db
    .select()
    .from(schema.channelPermissionOverrides)
    .where(eq(schema.channelPermissionOverrides.channelId, channelIdBigInt));

  if (overrides.length === 0) {
    return basePermissions;
  }

  // Get member's role IDs
  const memberRoleRows = await db
    .select({ roleId: schema.memberRoles.roleId })
    .from(schema.memberRoles)
    .where(
      and(
        eq(schema.memberRoles.serverId, serverIdBigInt),
        eq(schema.memberRoles.userId, userIdBigInt),
      ),
    );
  const memberRoleIds = new Set(memberRoleRows.map((r) => r.roleId));

  // Get the @everyone role
  const everyoneRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.serverId, serverIdBigInt),
      eq(schema.roles.isDefault, true),
    ),
  });

  // Apply @everyone role override first, then other role overrides, then member override
  const roleOverrides: Array<{ allow: bigint; deny: bigint }> = [];

  // @everyone override
  if (everyoneRole) {
    const everyoneOverride = overrides.find(
      (o) => o.targetType === 'role' && o.targetId === everyoneRole.id,
    );
    if (everyoneOverride) {
      roleOverrides.push({ allow: everyoneOverride.allow, deny: everyoneOverride.deny });
    }
  }

  // Other role overrides (combined)
  let roleAllow = 0n;
  let roleDeny = 0n;
  for (const override of overrides) {
    if (override.targetType === 'role' && memberRoleIds.has(override.targetId)) {
      roleAllow |= override.allow;
      roleDeny |= override.deny;
    }
  }
  if (roleAllow !== 0n || roleDeny !== 0n) {
    roleOverrides.push({ allow: roleAllow, deny: roleDeny });
  }

  // Member-specific override
  const memberOverride = overrides.find(
    (o) => o.targetType === 'member' && o.targetId === userIdBigInt,
  );
  if (memberOverride) {
    roleOverrides.push({ allow: memberOverride.allow, deny: memberOverride.deny });
  }

  return computeChannelPermissions(basePermissions, roleOverrides);
}

function canReadChannel(channelPerms: bigint): boolean {
  return hasPermission(channelPerms, Permission.READ_MESSAGES);
}

// ===== Channel CRUD =====

export async function createChannel(serverId: string, userId: string, input: CreateChannelInput) {
  await requirePermission(serverId, userId, Permission.MANAGE_CHANNELS);

  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const channelId = generateId();
  const normalizedName = normalizeChannelName(input.name);

  // Validate categoryId if provided
  if (input.categoryId) {
    const category = await db.query.channelCategories.findFirst({
      where: and(
        eq(schema.channelCategories.id, BigInt(input.categoryId)),
        eq(schema.channelCategories.serverId, serverIdBigInt),
      ),
    });
    if (!category) {
      throw new NotFoundError('Category not found');
    }
  }

  // Determine next position
  const [maxPos] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${schema.channels.position}), -1)::int` })
    .from(schema.channels)
    .where(eq(schema.channels.serverId, serverIdBigInt));

  const [channel] = await db
    .insert(schema.channels)
    .values({
      id: channelId,
      serverId: serverIdBigInt,
      categoryId: input.categoryId ? BigInt(input.categoryId) : null,
      name: normalizedName,
      type: input.type ?? 'text',
      position: maxPos.maxPosition + 1,
      isPrivate: input.isPrivate ?? false,
    })
    .returning();

  const response = channelToResponse(channel);

  // Broadcast CHANNEL_CREATE
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'CHANNEL_CREATE' as const,
    d: { channel: response },
  });

  return response;
}

export async function getServerChannels(serverId: string, userId: string) {
  await requireMembership(serverId, userId);

  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  // Get all categories
  const categories = await db
    .select()
    .from(schema.channelCategories)
    .where(eq(schema.channelCategories.serverId, serverIdBigInt))
    .orderBy(asc(schema.channelCategories.position));

  // Get all channels
  const allChannels = await db
    .select()
    .from(schema.channels)
    .where(eq(schema.channels.serverId, serverIdBigInt))
    .orderBy(asc(schema.channels.position));

  // Filter private channels: check if user has READ_MESSAGES permission for each private channel
  const visibleChannels: (typeof allChannels)[number][] = [];
  for (const channel of allChannels) {
    if (!channel.isPrivate) {
      visibleChannels.push(channel);
    } else {
      const channelPerms = await getChannelPermissionsForUser(
        channel.id.toString(),
        serverId,
        userId,
      );
      if (canReadChannel(channelPerms)) {
        visibleChannels.push(channel);
      }
    }
  }

  // Group channels by category
  const uncategorized = visibleChannels
    .filter((c) => c.categoryId === null)
    .map(channelToResponse);

  const categoryGroups = categories.map((cat) => ({
    category: categoryToResponse(cat),
    channels: visibleChannels
      .filter((c) => c.categoryId !== null && c.categoryId === cat.id)
      .map(channelToResponse),
  }));

  return {
    uncategorized,
    categories: categoryGroups,
  };
}

export async function updateChannel(channelId: string, userId: string, input: UpdateChannelInput) {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  const serverId = channel.serverId.toString();
  await requirePermission(serverId, userId, Permission.MANAGE_CHANNELS);

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    updateData.name = normalizeChannelName(input.name);
  }
  if (input.topic !== undefined) {
    updateData.topic = input.topic;
  }
  if (input.position !== undefined) {
    updateData.position = input.position;
  }
  if (input.categoryId !== undefined) {
    updateData.categoryId = input.categoryId !== null ? BigInt(input.categoryId) : null;
  }

  const [updated] = await db
    .update(schema.channels)
    .set(updateData)
    .where(eq(schema.channels.id, channelIdBigInt))
    .returning();

  const response = channelToResponse(updated);

  // Broadcast CHANNEL_UPDATE
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'CHANNEL_UPDATE' as const,
    d: { channel: response },
  });

  return response;
}

export async function deleteChannel(channelId: string, userId: string) {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  const serverId = channel.serverId.toString();
  await requirePermission(serverId, userId, Permission.MANAGE_CHANNELS);

  await db.delete(schema.channels).where(eq(schema.channels.id, channelIdBigInt));

  // Broadcast CHANNEL_DELETE
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'CHANNEL_DELETE' as const,
    d: { channelId, serverId },
  });
}

// ===== Category CRUD =====

export async function createCategory(serverId: string, userId: string, input: CreateCategoryInput) {
  await requirePermission(serverId, userId, Permission.MANAGE_CHANNELS);

  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const categoryId = generateId();

  // Determine next position
  const [maxPos] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${schema.channelCategories.position}), -1)::int` })
    .from(schema.channelCategories)
    .where(eq(schema.channelCategories.serverId, serverIdBigInt));

  const [category] = await db
    .insert(schema.channelCategories)
    .values({
      id: categoryId,
      serverId: serverIdBigInt,
      name: input.name,
      position: maxPos.maxPosition + 1,
    })
    .returning();

  return categoryToResponse(category);
}

export async function updateCategory(categoryId: string, userId: string, input: UpdateCategoryInput) {
  const db = getDb();
  const categoryIdBigInt = BigInt(categoryId);

  const category = await db.query.channelCategories.findFirst({
    where: eq(schema.channelCategories.id, categoryIdBigInt),
  });

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  const serverId = category.serverId.toString();
  await requirePermission(serverId, userId, Permission.MANAGE_CHANNELS);

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.position !== undefined) {
    updateData.position = input.position;
  }

  if (Object.keys(updateData).length === 0) {
    return categoryToResponse(category);
  }

  const [updated] = await db
    .update(schema.channelCategories)
    .set(updateData)
    .where(eq(schema.channelCategories.id, categoryIdBigInt))
    .returning();

  return categoryToResponse(updated);
}

export async function deleteCategory(categoryId: string, userId: string) {
  const db = getDb();
  const categoryIdBigInt = BigInt(categoryId);

  const category = await db.query.channelCategories.findFirst({
    where: eq(schema.channelCategories.id, categoryIdBigInt),
  });

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  const serverId = category.serverId.toString();
  await requirePermission(serverId, userId, Permission.MANAGE_CHANNELS);

  // Move orphaned channels to uncategorized (set categoryId to null)
  await db
    .update(schema.channels)
    .set({ categoryId: null, updatedAt: new Date() })
    .where(eq(schema.channels.categoryId, categoryIdBigInt));

  await db.delete(schema.channelCategories).where(eq(schema.channelCategories.id, categoryIdBigInt));
}

// ===== Channel Permission Overrides =====

export async function setPermissionOverride(
  channelId: string,
  userId: string,
  input: PermissionOverrideInput,
) {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  const serverId = channel.serverId.toString();
  await requirePermission(serverId, userId, Permission.MANAGE_ROLES);

  const targetIdBigInt = BigInt(input.targetId);
  const allowBigInt = BigInt(input.allow);
  const denyBigInt = BigInt(input.deny);

  // Upsert the permission override
  const [override] = await db
    .insert(schema.channelPermissionOverrides)
    .values({
      channelId: channelIdBigInt,
      targetType: input.targetType,
      targetId: targetIdBigInt,
      allow: allowBigInt,
      deny: denyBigInt,
    })
    .onConflictDoUpdate({
      target: [
        schema.channelPermissionOverrides.channelId,
        schema.channelPermissionOverrides.targetType,
        schema.channelPermissionOverrides.targetId,
      ],
      set: {
        allow: allowBigInt,
        deny: denyBigInt,
      },
    })
    .returning();

  return permissionOverrideToResponse(override);
}

export async function deletePermissionOverride(
  channelId: string,
  targetType: string,
  targetId: string,
  userId: string,
) {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  const serverId = channel.serverId.toString();
  await requirePermission(serverId, userId, Permission.MANAGE_ROLES);

  const targetIdBigInt = BigInt(targetId);

  await db
    .delete(schema.channelPermissionOverrides)
    .where(
      and(
        eq(schema.channelPermissionOverrides.channelId, channelIdBigInt),
        eq(schema.channelPermissionOverrides.targetType, targetType),
        eq(schema.channelPermissionOverrides.targetId, targetIdBigInt),
      ),
    );
}

export async function getChannelPermissionOverrides(channelId: string, userId: string) {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);

  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  const serverId = channel.serverId.toString();
  await requireMembership(serverId, userId);

  const overrides = await db
    .select()
    .from(schema.channelPermissionOverrides)
    .where(eq(schema.channelPermissionOverrides.channelId, channelIdBigInt));

  return overrides.map(permissionOverrideToResponse);
}

// ===== Lookup helpers (used by routes) =====

export async function getChannelServerId(channelId: string): Promise<string> {
  const db = getDb();
  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, BigInt(channelId)),
  });
  if (!channel) {
    throw new NotFoundError('Channel not found');
  }
  return channel.serverId.toString();
}

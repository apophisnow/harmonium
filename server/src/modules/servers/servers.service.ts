import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { DEFAULT_PERMISSIONS, Permission, hasPermission } from '@harmonium/shared';
import type { UserStatus } from '@harmonium/shared';
import { getPubSubManager } from '../../ws/pubsub.js';
import { computeServerPermissions, getHighestRolePosition } from '../../utils/permissions.js';
import type { CreateServerInput, UpdateServerInput } from './servers.schemas.js';

function serverToResponse(server: typeof schema.servers.$inferSelect) {
  return {
    id: server.id.toString(),
    name: server.name,
    iconUrl: server.iconUrl,
    ownerId: server.ownerId.toString(),
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  };
}

function memberToResponse(
  member: typeof schema.serverMembers.$inferSelect,
  user?: typeof schema.users.$inferSelect,
) {
  return {
    serverId: member.serverId.toString(),
    userId: member.userId.toString(),
    nickname: member.nickname,
    joinedAt: member.joinedAt.toISOString(),
    user: user
      ? {
          id: user.id.toString(),
          username: user.username,
          discriminator: user.discriminator,
          avatarUrl: user.avatarUrl,
          aboutMe: user.aboutMe,
          status: user.status as UserStatus,
          customStatus: user.customStatus,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }
      : undefined,
  };
}

export async function createServer(userId: string, input: CreateServerInput) {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const serverId = generateId();

  // Insert the server
  const [server] = await db
    .insert(schema.servers)
    .values({
      id: serverId,
      name: input.name,
      ownerId: userIdBigInt,
    })
    .returning();

  // Add creator as a member
  await db.insert(schema.serverMembers).values({
    serverId: serverId,
    userId: userIdBigInt,
  });

  // Create default @everyone role
  const roleId = generateId();
  await db.insert(schema.roles).values({
    id: roleId,
    serverId: serverId,
    name: '@everyone',
    isDefault: true,
    permissions: DEFAULT_PERMISSIONS,
    position: 0,
  });

  // Create default "general" text channel
  const channelId = generateId();
  await db.insert(schema.channels).values({
    id: channelId,
    serverId: serverId,
    name: 'general',
    type: 'text',
    position: 0,
  });

  return serverToResponse(server);
}

export async function getUserServers(userId: string) {
  const db = getDb();
  const userIdBigInt = BigInt(userId);

  const rows = await db
    .select({
      server: schema.servers,
    })
    .from(schema.serverMembers)
    .innerJoin(schema.servers, eq(schema.serverMembers.serverId, schema.servers.id))
    .where(eq(schema.serverMembers.userId, userIdBigInt));

  return rows.map((row) => serverToResponse(row.server));
}

export async function getServerById(serverId: string, userId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Verify membership
  const membership = await db.query.serverMembers.findFirst({
    where: and(
      eq(schema.serverMembers.serverId, serverIdBigInt),
      eq(schema.serverMembers.userId, userIdBigInt),
    ),
  });

  if (!membership) {
    throw new ForbiddenError('You are not a member of this server');
  }

  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverIdBigInt),
  });

  if (!server) {
    throw new NotFoundError('Server not found');
  }

  // Get member count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.serverId, serverIdBigInt));

  return {
    ...serverToResponse(server),
    memberCount: countResult.count,
  };
}

export async function updateServer(serverId: string, userId: string, input: UpdateServerInput) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  // Verify owner
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverIdBigInt),
  });

  if (!server) {
    throw new NotFoundError('Server not found');
  }

  if (server.ownerId.toString() !== userId) {
    throw new ForbiddenError('Only the server owner can update the server');
  }

  const [updated] = await db
    .update(schema.servers)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(schema.servers.id, serverIdBigInt))
    .returning();

  const response = serverToResponse(updated);

  // Broadcast SERVER_UPDATE to all members
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'SERVER_UPDATE' as const,
    d: { server: response },
  });

  return response;
}

export async function deleteServer(serverId: string, userId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  // Verify owner
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverIdBigInt),
  });

  if (!server) {
    throw new NotFoundError('Server not found');
  }

  if (server.ownerId.toString() !== userId) {
    throw new ForbiddenError('Only the server owner can delete the server');
  }

  // Broadcast SERVER_DELETE BEFORE deleting from DB,
  // because after deletion the pub/sub subscriptions for this server won't exist
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'SERVER_DELETE' as const,
    d: { serverId },
  });

  await db.delete(schema.servers).where(eq(schema.servers.id, serverIdBigInt));
}

export async function getServerMembers(serverId: string, userId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Verify membership
  const membership = await db.query.serverMembers.findFirst({
    where: and(
      eq(schema.serverMembers.serverId, serverIdBigInt),
      eq(schema.serverMembers.userId, userIdBigInt),
    ),
  });

  if (!membership) {
    throw new ForbiddenError('You are not a member of this server');
  }

  const rows = await db
    .select({
      member: schema.serverMembers,
      user: schema.users,
    })
    .from(schema.serverMembers)
    .innerJoin(schema.users, eq(schema.serverMembers.userId, schema.users.id))
    .where(eq(schema.serverMembers.serverId, serverIdBigInt));

  // Fetch all member roles for this server
  const allMemberRoles = await db
    .select({ userId: schema.memberRoles.userId, roleId: schema.memberRoles.roleId })
    .from(schema.memberRoles)
    .where(eq(schema.memberRoles.serverId, serverIdBigInt));

  const roleMap = new Map<string, string[]>();
  for (const mr of allMemberRoles) {
    const uid = mr.userId.toString();
    if (!roleMap.has(uid)) roleMap.set(uid, []);
    roleMap.get(uid)!.push(mr.roleId.toString());
  }

  return rows.map((row) => ({
    ...memberToResponse(row.member, row.user),
    roles: roleMap.get(row.member.userId.toString()) ?? [],
  }));
}

export async function leaveServer(serverId: string, userId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Check that the user is not the owner
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverIdBigInt),
  });

  if (!server) {
    throw new NotFoundError('Server not found');
  }

  if (server.ownerId.toString() === userId) {
    throw new ForbiddenError('Server owner cannot leave the server. Transfer ownership or delete the server.');
  }

  // Remove from server_members
  await db
    .delete(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, serverIdBigInt),
        eq(schema.serverMembers.userId, userIdBigInt),
      ),
    );

  // Publish MEMBER_LEAVE via pub/sub
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'MEMBER_LEAVE' as const,
    d: { serverId, userId },
  });
}

export async function kickMember(serverId: string, actorId: string, targetUserId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const targetUserIdBigInt = BigInt(targetUserId);

  // Find server, verify it exists
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverIdBigInt),
  });

  if (!server) {
    throw new NotFoundError('Server not found');
  }

  // Cannot kick the owner
  if (server.ownerId.toString() === targetUserId) {
    throw new ForbiddenError('Cannot kick the server owner');
  }

  // Cannot kick yourself
  if (actorId === targetUserId) {
    throw new ForbiddenError('Cannot kick yourself');
  }

  // Check actor has KICK_MEMBERS permission
  const perms = await computeServerPermissions(db, serverId, actorId);
  if (!hasPermission(perms, Permission.KICK_MEMBERS)) {
    throw new ForbiddenError('You do not have permission to kick members');
  }

  // Hierarchy check: actor's highest role position must be > target's
  const actorPosition = await getHighestRolePosition(db, serverId, actorId);
  const targetPosition = await getHighestRolePosition(db, serverId, targetUserId);
  if (actorPosition <= targetPosition) {
    throw new ForbiddenError('Cannot kick a member with an equal or higher role');
  }

  // Remove target from server_members
  await db
    .delete(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, serverIdBigInt),
        eq(schema.serverMembers.userId, targetUserIdBigInt),
      ),
    );

  // Broadcast MEMBER_LEAVE via pubsub
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'MEMBER_LEAVE' as const,
    d: { serverId, userId: targetUserId },
  });
}

export async function addMemberToServer(serverId: string, userId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Add to server_members
  await db.insert(schema.serverMembers).values({
    serverId: serverIdBigInt,
    userId: userIdBigInt,
  });

  // Fetch the member with user data for the event payload
  const [row] = await db
    .select({
      member: schema.serverMembers,
      user: schema.users,
    })
    .from(schema.serverMembers)
    .innerJoin(schema.users, eq(schema.serverMembers.userId, schema.users.id))
    .where(
      and(
        eq(schema.serverMembers.serverId, serverIdBigInt),
        eq(schema.serverMembers.userId, userIdBigInt),
      ),
    );

  const memberData = memberToResponse(row.member, row.user);

  // Publish MEMBER_JOIN via pub/sub
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'MEMBER_JOIN' as const,
    d: { serverId, member: memberData },
  });

  return memberData;
}

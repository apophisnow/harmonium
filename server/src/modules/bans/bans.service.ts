import { eq, and, gte, inArray } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { Permission, hasPermission } from '@harmonium/shared';
import type { UserStatus } from '@harmonium/shared';
import { getPubSubManager } from '../../ws/pubsub.js';
import { computeServerPermissions, getHighestRolePosition } from '../../utils/permissions.js';
import { leaveVoice } from '../voice/voice.service.js';
import type { BanMemberInput } from './bans.schemas.js';

function banToResponse(
  ban: typeof schema.bans.$inferSelect,
  user: typeof schema.users.$inferSelect,
) {
  return {
    serverId: ban.serverId.toString(),
    user: {
      id: user.id.toString(),
      username: user.username,
      discriminator: user.discriminator,
      avatarUrl: user.avatarUrl,
      aboutMe: user.aboutMe,
      status: user.status as UserStatus,
      customStatus: user.customStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    reason: ban.reason,
    bannedBy: ban.bannedBy.toString(),
    createdAt: ban.createdAt.toISOString(),
  };
}

export async function banMember(
  serverId: string,
  actorId: string,
  targetUserId: string,
  input: BanMemberInput,
) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const targetUserIdBigInt = BigInt(targetUserId);
  const actorIdBigInt = BigInt(actorId);

  // Verify server exists
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverIdBigInt),
  });

  if (!server) {
    throw new NotFoundError('Server not found');
  }

  // Cannot ban the owner
  if (server.ownerId.toString() === targetUserId) {
    throw new ForbiddenError('Cannot ban the server owner');
  }

  // Cannot ban yourself
  if (actorId === targetUserId) {
    throw new ForbiddenError('Cannot ban yourself');
  }

  // Check actor has BAN_MEMBERS permission
  const perms = await computeServerPermissions(db, serverId, actorId);
  if (!hasPermission(perms, Permission.BAN_MEMBERS)) {
    throw new ForbiddenError('You do not have permission to ban members');
  }

  // Hierarchy check: actor's highest role position must be > target's
  const actorPosition = await getHighestRolePosition(db, serverId, actorId);
  const targetPosition = await getHighestRolePosition(db, serverId, targetUserId);
  if (actorPosition <= targetPosition) {
    throw new ForbiddenError('Cannot ban a member with an equal or higher role');
  }

  // Upsert ban record (handles re-ban with updated reason)
  await db
    .insert(schema.bans)
    .values({
      serverId: serverIdBigInt,
      userId: targetUserIdBigInt,
      reason: input.reason ?? null,
      bannedBy: actorIdBigInt,
    })
    .onConflictDoUpdate({
      target: [schema.bans.serverId, schema.bans.userId],
      set: {
        reason: input.reason ?? null,
        bannedBy: actorIdBigInt,
        createdAt: new Date(),
      },
    });

  // Disconnect from voice if in a voice channel
  await leaveVoice(targetUserId);

  // Remove from server_members
  await db
    .delete(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, serverIdBigInt),
        eq(schema.serverMembers.userId, targetUserIdBigInt),
      ),
    );

  // Purge recent messages if requested (soft-delete last 24h)
  if (input.purgeMessages) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get all channel IDs for this server
    const serverChannels = await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .where(eq(schema.channels.serverId, serverIdBigInt));

    const channelIds = serverChannels.map((c) => c.id);

    if (channelIds.length > 0) {
      await db
        .update(schema.messages)
        .set({ isDeleted: true })
        .where(
          and(
            eq(schema.messages.authorId, targetUserIdBigInt),
            inArray(schema.messages.channelId, channelIds),
            gte(schema.messages.createdAt, twentyFourHoursAgo),
          ),
        );
    }
  }

  // Broadcast MEMBER_BAN and MEMBER_LEAVE
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'MEMBER_BAN' as const,
    d: { serverId, userId: targetUserId },
  });
  await pubsub.publishToServer(serverId, {
    op: 'MEMBER_LEAVE' as const,
    d: { serverId, userId: targetUserId },
  });
}

export async function unbanMember(serverId: string, actorId: string, targetUserId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const targetUserIdBigInt = BigInt(targetUserId);

  // Check actor has BAN_MEMBERS permission
  const perms = await computeServerPermissions(db, serverId, actorId);
  if (!hasPermission(perms, Permission.BAN_MEMBERS)) {
    throw new ForbiddenError('You do not have permission to manage bans');
  }

  // Delete the ban
  const result = await db
    .delete(schema.bans)
    .where(
      and(
        eq(schema.bans.serverId, serverIdBigInt),
        eq(schema.bans.userId, targetUserIdBigInt),
      ),
    )
    .returning();

  if (result.length === 0) {
    throw new NotFoundError('Ban not found');
  }
}

export async function getBans(serverId: string, actorId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  // Check actor has BAN_MEMBERS permission
  const perms = await computeServerPermissions(db, serverId, actorId);
  if (!hasPermission(perms, Permission.BAN_MEMBERS)) {
    throw new ForbiddenError('You do not have permission to view bans');
  }

  const rows = await db
    .select({
      ban: schema.bans,
      user: schema.users,
    })
    .from(schema.bans)
    .innerJoin(schema.users, eq(schema.bans.userId, schema.users.id))
    .where(eq(schema.bans.serverId, serverIdBigInt));

  return rows.map((row) => banToResponse(row.ban, row.user));
}

export async function isBanned(serverId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const ban = await db.query.bans.findFirst({
    where: and(
      eq(schema.bans.serverId, BigInt(serverId)),
      eq(schema.bans.userId, BigInt(userId)),
    ),
  });
  return !!ban;
}

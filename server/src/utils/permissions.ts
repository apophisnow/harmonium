import { eq, and, sql } from 'drizzle-orm';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Permission, ALL_PERMISSIONS, hasPermission } from '@harmonium/shared';
import type { Database } from '../db/index.js';
import { getDb, schema } from '../db/index.js';
import { ForbiddenError, NotFoundError } from './errors.js';

/**
 * Compute effective server-level permissions for a user.
 *
 * Algorithm:
 * 1. Start with the @everyone role's permissions.
 * 2. OR in every additional role the member holds.
 * 3. If the result includes ADMINISTRATOR, return ALL_PERMISSIONS.
 * 4. The server owner always receives ALL_PERMISSIONS.
 *
 * Uses 2 queries: one JOIN for server+membership, one for all applicable roles.
 */
export async function computeServerPermissions(
  db: Database,
  serverId: string,
  userId: string,
): Promise<bigint> {
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Query 1: Server lookup + membership check in a single JOIN
  const [serverMemberRow] = await db
    .select({
      ownerId: schema.servers.ownerId,
      memberUserId: schema.serverMembers.userId,
    })
    .from(schema.servers)
    .leftJoin(
      schema.serverMembers,
      and(
        eq(schema.serverMembers.serverId, schema.servers.id),
        eq(schema.serverMembers.userId, userIdBigInt),
      ),
    )
    .where(eq(schema.servers.id, serverIdBigInt));

  if (!serverMemberRow) {
    throw new NotFoundError('Server not found');
  }

  if (serverMemberRow.ownerId === userIdBigInt) {
    return ALL_PERMISSIONS;
  }

  if (!serverMemberRow.memberUserId) {
    throw new ForbiddenError('You are not a member of this server');
  }

  // Query 2: Get @everyone role + all member roles in one query using UNION via OR
  // Fetches: roles where (serverId matches AND isDefault=true) OR (role is assigned to this member)
  const roleRows = await db
    .select({
      permissions: schema.roles.permissions,
      isDefault: schema.roles.isDefault,
    })
    .from(schema.roles)
    .leftJoin(
      schema.memberRoles,
      and(
        eq(schema.memberRoles.roleId, schema.roles.id),
        eq(schema.memberRoles.userId, userIdBigInt),
      ),
    )
    .where(
      and(
        eq(schema.roles.serverId, serverIdBigInt),
        sql`(${schema.roles.isDefault} = true OR ${schema.memberRoles.userId} IS NOT NULL)`,
      ),
    );

  let permissions = 0n;
  for (const row of roleRows) {
    permissions |= row.permissions;
  }

  // If ADMINISTRATOR, grant all
  if (hasPermission(permissions, Permission.ADMINISTRATOR)) {
    return ALL_PERMISSIONS;
  }

  return permissions;
}

/**
 * Compute effective channel-level permissions for a user.
 *
 * Algorithm:
 * 1. Start with server-level permissions.
 * 2. If ADMINISTRATOR, return ALL_PERMISSIONS (already handled by computeServerPermissions).
 * 3. Apply @everyone role channel overrides (deny then allow).
 * 4. Apply overrides for each of the member's roles (deny then allow, accumulated).
 * 5. Apply member-specific overrides (deny then allow).
 *
 * Uses computeServerPermissions (2 queries) + 1 query for overrides + role context = 3 total.
 */
export async function computeChannelPermissions(
  db: Database,
  serverId: string,
  channelId: string,
  userId: string,
): Promise<bigint> {
  let permissions = await computeServerPermissions(db, serverId, userId);

  // If already ALL_PERMISSIONS (admin/owner), no overrides needed
  if (permissions === ALL_PERMISSIONS) {
    return ALL_PERMISSIONS;
  }

  const channelIdBigInt = BigInt(channelId);
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Single query: get all channel overrides + @everyone role id + member role ids
  // We fetch overrides and role context in parallel to reduce sequential queries
  const [overrides, everyoneRole, memberRoleRows] = await Promise.all([
    db.query.channelPermissionOverrides.findMany({
      where: eq(schema.channelPermissionOverrides.channelId, channelIdBigInt),
    }),
    db.query.roles.findFirst({
      where: and(
        eq(schema.roles.serverId, serverIdBigInt),
        eq(schema.roles.isDefault, true),
      ),
    }),
    db
      .select({ roleId: schema.memberRoles.roleId })
      .from(schema.memberRoles)
      .where(
        and(
          eq(schema.memberRoles.serverId, serverIdBigInt),
          eq(schema.memberRoles.userId, userIdBigInt),
        ),
      ),
  ]);

  // 1. Apply @everyone role overrides
  if (everyoneRole) {
    const everyoneOverride = overrides.find(
      (o) => o.targetType === 'role' && o.targetId === everyoneRole.id,
    );
    if (everyoneOverride) {
      permissions &= ~everyoneOverride.deny;
      permissions |= everyoneOverride.allow;
    }
  }

  // 2. Apply member's role overrides (accumulated)
  const memberRoleIds = new Set(memberRoleRows.map((r) => r.roleId));

  let roleAllow = 0n;
  let roleDeny = 0n;

  for (const override of overrides) {
    if (override.targetType === 'role' && memberRoleIds.has(override.targetId)) {
      roleAllow |= override.allow;
      roleDeny |= override.deny;
    }
  }

  permissions &= ~roleDeny;
  permissions |= roleAllow;

  // 3. Apply member-specific overrides
  const memberOverride = overrides.find(
    (o) => o.targetType === 'member' && o.targetId === userIdBigInt,
  );

  if (memberOverride) {
    permissions &= ~memberOverride.deny;
    permissions |= memberOverride.allow;
  }

  return permissions;
}

/**
 * Get the highest role position for a user in a server.
 * The server owner is treated as having infinite position.
 * A user with no assigned roles (only @everyone) returns 0.
 */
export async function getHighestRolePosition(
  db: Database,
  serverId: string,
  userId: string,
): Promise<number> {
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  // Check if user is the server owner — owner has infinite position
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverIdBigInt),
  });
  if (server && server.ownerId === userIdBigInt) {
    return Infinity;
  }

  const memberRoleRows = await db
    .select({ position: schema.roles.position })
    .from(schema.memberRoles)
    .innerJoin(schema.roles, eq(schema.memberRoles.roleId, schema.roles.id))
    .where(
      and(
        eq(schema.memberRoles.serverId, serverIdBigInt),
        eq(schema.memberRoles.userId, userIdBigInt),
      ),
    );

  if (memberRoleRows.length === 0) return 0; // only @everyone
  return Math.max(...memberRoleRows.map((r) => r.position));
}

/**
 * Fastify preHandler factory that checks a server-level permission.
 * Expects `serverId` in request params.
 */
export function requirePermission(permission: bigint) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const params = request.params as { serverId?: string };
    const serverId = params.serverId;

    if (!serverId) {
      throw new ForbiddenError('Missing serverId parameter');
    }

    const db = getDb();
    const userPermissions = await computeServerPermissions(db, serverId, request.user.userId);

    if (!hasPermission(userPermissions, permission)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  };
}

/**
 * Fastify preHandler factory that checks a channel-level permission.
 * Expects `channelId` in request params, looks up `serverId` from the channel.
 * For DM channels (serverId is null), checks membership instead of server permissions.
 */
export function requireChannelPermission(permission: bigint) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const params = request.params as { channelId?: string; serverId?: string };
    const channelId = params.channelId;

    if (!channelId) {
      throw new ForbiddenError('Missing channelId parameter');
    }

    const db = getDb();

    // Look up the channel
    const channel = await db.query.channels.findFirst({
      where: eq(schema.channels.id, BigInt(channelId)),
    });

    if (!channel) {
      throw new NotFoundError('Channel not found');
    }

    // DM channels: check membership instead of server permissions
    if (channel.isDm || channel.serverId === null) {
      const membership = await db.query.dmChannelMembers.findFirst({
        where: and(
          eq(schema.dmChannelMembers.channelId, BigInt(channelId)),
          eq(schema.dmChannelMembers.userId, BigInt(request.user.userId)),
        ),
      });

      if (!membership) {
        throw new ForbiddenError('You are not a member of this DM channel');
      }

      // DM members have all basic message permissions (read, send)
      return;
    }

    // Server channels: use server permission system
    const serverId = params.serverId ?? channel.serverId.toString();

    const userPermissions = await computeChannelPermissions(
      db,
      serverId,
      channelId,
      request.user.userId,
    );

    if (!hasPermission(userPermissions, permission)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
  };
}

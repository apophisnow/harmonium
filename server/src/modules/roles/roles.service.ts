import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { getHighestRolePosition } from '../../utils/permissions.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import type { CreateRoleInput, UpdateRoleInput } from './roles.schemas.js';

function roleToResponse(role: typeof schema.roles.$inferSelect) {
  return {
    id: role.id.toString(),
    serverId: role.serverId.toString(),
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.permissions.toString(),
    isDefault: role.isDefault,
    createdAt: role.createdAt.toISOString(),
  };
}

export async function createRole(serverId: string, input: CreateRoleInput) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  // Determine the next position (max position + 1)
  const [maxPos] = await db
    .select({ maxPosition: sql<number>`coalesce(max(${schema.roles.position}), 0)::int` })
    .from(schema.roles)
    .where(eq(schema.roles.serverId, serverIdBigInt));

  const roleId = generateId();

  const permissions = input.permissions ? BigInt(input.permissions) : 0n;

  const [role] = await db
    .insert(schema.roles)
    .values({
      id: roleId,
      serverId: serverIdBigInt,
      name: input.name,
      color: input.color ?? null,
      position: maxPos.maxPosition + 1,
      permissions,
      isDefault: false,
    })
    .returning();

  return roleToResponse(role);
}

export async function getServerRoles(serverId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  const roles = await db.query.roles.findMany({
    where: eq(schema.roles.serverId, serverIdBigInt),
    orderBy: (roles, { asc }) => [asc(roles.position)],
  });

  return roles.map(roleToResponse);
}

export async function updateRole(serverId: string, roleId: string, input: UpdateRoleInput, actorId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const roleIdBigInt = BigInt(roleId);

  // Find the role
  const existingRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.id, roleIdBigInt),
      eq(schema.roles.serverId, serverIdBigInt),
    ),
  });

  if (!existingRole) {
    throw new NotFoundError('Role not found');
  }

  // Hierarchy check: cannot edit a role at or above your own highest role (unless it's @everyone)
  if (!existingRole.isDefault) {
    const actorPosition = await getHighestRolePosition(db, serverId, actorId);
    if (existingRole.position >= actorPosition) {
      throw new ForbiddenError('Cannot edit a role at or above your own highest role');
    }
  }

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) {
    // Cannot rename @everyone
    if (existingRole.isDefault && input.name !== '@everyone') {
      throw new ForbiddenError('Cannot rename the @everyone role');
    }
    updateData.name = input.name;
  }

  if (input.color !== undefined) {
    updateData.color = input.color;
  }

  if (input.permissions !== undefined) {
    updateData.permissions = BigInt(input.permissions);
  }

  if (input.position !== undefined) {
    // Cannot change position of @everyone (always 0)
    if (existingRole.isDefault) {
      throw new ForbiddenError('Cannot change position of the @everyone role');
    }
    updateData.position = input.position;
  }

  if (Object.keys(updateData).length === 0) {
    return roleToResponse(existingRole);
  }

  const [updated] = await db
    .update(schema.roles)
    .set(updateData)
    .where(
      and(
        eq(schema.roles.id, roleIdBigInt),
        eq(schema.roles.serverId, serverIdBigInt),
      ),
    )
    .returning();

  // Broadcast ROLE_UPDATE via pubsub
  const pubsub = getPubSubManager();
  const response = roleToResponse(updated);
  await pubsub.publishToServer(serverId, {
    op: 'ROLE_UPDATE' as const,
    d: { serverId, role: response },
  });

  return response;
}

export async function deleteRole(serverId: string, roleId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const roleIdBigInt = BigInt(roleId);

  // Find the role
  const existingRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.id, roleIdBigInt),
      eq(schema.roles.serverId, serverIdBigInt),
    ),
  });

  if (!existingRole) {
    throw new NotFoundError('Role not found');
  }

  if (existingRole.isDefault) {
    throw new ForbiddenError('Cannot delete the @everyone role');
  }

  await db
    .delete(schema.roles)
    .where(
      and(
        eq(schema.roles.id, roleIdBigInt),
        eq(schema.roles.serverId, serverIdBigInt),
      ),
    );
}

export async function reorderRoles(serverId: string, rolePositions: Array<{ id: string; position: number }>) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  // Validate all roles belong to this server and none are @everyone
  for (const { id, position } of rolePositions) {
    const role = await db.query.roles.findFirst({
      where: and(
        eq(schema.roles.id, BigInt(id)),
        eq(schema.roles.serverId, serverIdBigInt),
      ),
    });

    if (!role) {
      throw new NotFoundError(`Role ${id} not found in this server`);
    }

    if (role.isDefault && position !== 0) {
      throw new ForbiddenError('Cannot change position of the @everyone role');
    }
  }

  // Batch update positions
  for (const { id, position } of rolePositions) {
    await db
      .update(schema.roles)
      .set({ position })
      .where(
        and(
          eq(schema.roles.id, BigInt(id)),
          eq(schema.roles.serverId, serverIdBigInt),
        ),
      );
  }

  // Return updated roles
  return getServerRoles(serverId);
}

export async function assignRole(serverId: string, roleId: string, userId: string, actorId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const roleIdBigInt = BigInt(roleId);
  const userIdBigInt = BigInt(userId);

  // Verify the role belongs to this server
  const role = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.id, roleIdBigInt),
      eq(schema.roles.serverId, serverIdBigInt),
    ),
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  if (role.isDefault) {
    throw new ForbiddenError('Cannot manually assign the @everyone role');
  }

  // Hierarchy check: cannot assign a role at or above your own highest role
  const actorPosition = await getHighestRolePosition(db, serverId, actorId);
  if (role.position >= actorPosition) {
    throw new ForbiddenError('Cannot assign a role at or above your own highest role');
  }

  // Verify the user is a member of the server
  const membership = await db.query.serverMembers.findFirst({
    where: and(
      eq(schema.serverMembers.serverId, serverIdBigInt),
      eq(schema.serverMembers.userId, userIdBigInt),
    ),
  });

  if (!membership) {
    throw new NotFoundError('User is not a member of this server');
  }

  // Insert the member role (ignore conflict if already assigned)
  await db
    .insert(schema.memberRoles)
    .values({
      serverId: serverIdBigInt,
      userId: userIdBigInt,
      roleId: roleIdBigInt,
    })
    .onConflictDoNothing();

  // Broadcast MEMBER_UPDATE with updated roles
  const memberRoleIds = await db
    .select({ roleId: schema.memberRoles.roleId })
    .from(schema.memberRoles)
    .where(and(
      eq(schema.memberRoles.serverId, serverIdBigInt),
      eq(schema.memberRoles.userId, userIdBigInt),
    ));
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'MEMBER_UPDATE' as const,
    d: { serverId, userId, roles: memberRoleIds.map(r => r.roleId.toString()) },
  });

  return roleToResponse(role);
}

export async function removeRole(serverId: string, roleId: string, userId: string, actorId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const roleIdBigInt = BigInt(roleId);
  const userIdBigInt = BigInt(userId);

  // Verify the role belongs to this server
  const role = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.id, roleIdBigInt),
      eq(schema.roles.serverId, serverIdBigInt),
    ),
  });

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  if (role.isDefault) {
    throw new ForbiddenError('Cannot remove the @everyone role');
  }

  // Hierarchy check: cannot remove a role at or above your own highest role
  const actorPosition = await getHighestRolePosition(db, serverId, actorId);
  if (role.position >= actorPosition) {
    throw new ForbiddenError('Cannot remove a role at or above your own highest role');
  }

  await db
    .delete(schema.memberRoles)
    .where(
      and(
        eq(schema.memberRoles.serverId, serverIdBigInt),
        eq(schema.memberRoles.userId, userIdBigInt),
        eq(schema.memberRoles.roleId, roleIdBigInt),
      ),
    );

  // Broadcast MEMBER_UPDATE with updated roles
  const memberRoleIds = await db
    .select({ roleId: schema.memberRoles.roleId })
    .from(schema.memberRoles)
    .where(and(
      eq(schema.memberRoles.serverId, serverIdBigInt),
      eq(schema.memberRoles.userId, userIdBigInt),
    ));
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId, {
    op: 'MEMBER_UPDATE' as const,
    d: { serverId, userId, roles: memberRoleIds.map(r => r.roleId.toString()) },
  });
}

export async function getMemberRoles(serverId: string, userId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const userIdBigInt = BigInt(userId);

  const rows = await db
    .select({ role: schema.roles })
    .from(schema.memberRoles)
    .innerJoin(schema.roles, eq(schema.memberRoles.roleId, schema.roles.id))
    .where(
      and(
        eq(schema.memberRoles.serverId, serverIdBigInt),
        eq(schema.memberRoles.userId, userIdBigInt),
      ),
    );

  return rows.map((row) => roleToResponse(row.role));
}

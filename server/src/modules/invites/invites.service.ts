import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../utils/errors.js';
import { hasPermission, Permission } from '@harmonium/shared';
import { addMemberToServer } from '../servers/servers.service.js';
import type { CreateInviteInput } from './invites.schemas.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateInviteCode(): string {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

function inviteToResponse(
  invite: typeof schema.invites.$inferSelect,
  server?: typeof schema.servers.$inferSelect,
  inviter?: typeof schema.users.$inferSelect,
  memberCount?: number,
) {
  return {
    code: invite.code,
    serverId: invite.serverId.toString(),
    inviterId: invite.inviterId.toString(),
    maxUses: invite.maxUses,
    useCount: invite.useCount,
    expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
    createdAt: invite.createdAt.toISOString(),
    server: server
      ? {
          id: server.id.toString(),
          name: server.name,
          iconUrl: server.iconUrl,
          ...(memberCount !== undefined ? { memberCount } : {}),
        }
      : undefined,
    inviter: inviter
      ? {
          id: inviter.id.toString(),
          username: inviter.username,
          discriminator: inviter.discriminator,
          avatarUrl: inviter.avatarUrl,
          aboutMe: inviter.aboutMe,
          status: inviter.status,
          customStatus: inviter.customStatus,
          createdAt: inviter.createdAt.toISOString(),
          updatedAt: inviter.updatedAt.toISOString(),
        }
      : undefined,
  };
}

/** Compute the effective permissions for a user in a server */
async function getUserServerPermissions(serverId: bigint, userId: bigint): Promise<bigint> {
  const db = getDb();

  // Check if user is server owner -- owners have all permissions
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverId),
  });

  if (server && server.ownerId === userId) {
    // Owner has all permissions
    return ~0n;
  }

  // Get @everyone (default) role permissions
  const defaultRole = await db.query.roles.findFirst({
    where: and(
      eq(schema.roles.serverId, serverId),
      eq(schema.roles.isDefault, true),
    ),
  });

  let permissions = defaultRole?.permissions ?? 0n;

  // Get member's assigned roles
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

  // OR together all role permissions
  for (const row of memberRoleRows) {
    permissions |= row.role.permissions;
  }

  return permissions;
}

export async function createInvite(serverId: string, inviterId: string, input: CreateInviteInput) {
  const db = getDb();
  const code = generateInviteCode();

  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000)
    : null;

  const [invite] = await db
    .insert(schema.invites)
    .values({
      code,
      serverId: BigInt(serverId),
      inviterId: BigInt(inviterId),
      maxUses: input.maxUses ?? null,
      expiresAt,
    })
    .returning();

  return inviteToResponse(invite);
}

export async function getInviteInfo(code: string) {
  const db = getDb();

  const [row] = await db
    .select({
      invite: schema.invites,
      server: schema.servers,
      inviter: schema.users,
    })
    .from(schema.invites)
    .innerJoin(schema.servers, eq(schema.invites.serverId, schema.servers.id))
    .innerJoin(schema.users, eq(schema.invites.inviterId, schema.users.id))
    .where(eq(schema.invites.code, code));

  if (!row) {
    throw new NotFoundError('Invite not found');
  }

  // Get member count for the server
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.serverId, row.invite.serverId));

  return inviteToResponse(row.invite, row.server, row.inviter, countResult.count);
}

export async function getServerInvites(serverId: string) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  const rows = await db
    .select({
      invite: schema.invites,
      inviter: schema.users,
    })
    .from(schema.invites)
    .innerJoin(schema.users, eq(schema.invites.inviterId, schema.users.id))
    .where(eq(schema.invites.serverId, serverIdBigInt));

  return rows.map((row) => inviteToResponse(row.invite, undefined, row.inviter));
}

export async function acceptInvite(code: string, userId: string) {
  const db = getDb();

  const invite = await db.query.invites.findFirst({
    where: eq(schema.invites.code, code),
  });

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  // Check if expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new ValidationError('Invite has expired');
  }

  // Check if max uses exceeded
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    throw new ValidationError('Invite has reached its maximum number of uses');
  }

  const userIdBigInt = BigInt(userId);
  const serverId = invite.serverId;

  // Check if already a member
  const existingMember = await db.query.serverMembers.findFirst({
    where: and(
      eq(schema.serverMembers.serverId, serverId),
      eq(schema.serverMembers.userId, userIdBigInt),
    ),
  });

  if (existingMember) {
    throw new ConflictError('You are already a member of this server');
  }

  // Increment use count
  await db
    .update(schema.invites)
    .set({ useCount: invite.useCount + 1 })
    .where(eq(schema.invites.code, code));

  // Add user to server (this also publishes MEMBER_JOIN event)
  const member = await addMemberToServer(serverId.toString(), userId);

  // Fetch server data to return
  const server = await db.query.servers.findFirst({
    where: eq(schema.servers.id, serverId),
  });

  return {
    server: server
      ? {
          id: server.id.toString(),
          name: server.name,
          iconUrl: server.iconUrl,
          ownerId: server.ownerId.toString(),
          createdAt: server.createdAt.toISOString(),
          updatedAt: server.updatedAt.toISOString(),
        }
      : undefined,
    member,
  };
}

export async function deleteInvite(code: string, userId: string, serverId: string) {
  const db = getDb();

  const invite = await db.query.invites.findFirst({
    where: eq(schema.invites.code, code),
  });

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  // Verify the invite belongs to this server
  if (invite.serverId.toString() !== serverId) {
    throw new NotFoundError('Invite not found');
  }

  const userIdBigInt = BigInt(userId);
  const serverIdBigInt = BigInt(serverId);

  // Allow if the user is the invite creator
  if (invite.inviterId !== userIdBigInt) {
    // Otherwise check MANAGE_SERVER permission
    const permissions = await getUserServerPermissions(serverIdBigInt, userIdBigInt);
    if (!hasPermission(permissions, Permission.MANAGE_SERVER)) {
      throw new ForbiddenError('You do not have permission to delete this invite');
    }
  }

  await db.delete(schema.invites).where(eq(schema.invites.code, code));
}

export { getUserServerPermissions };

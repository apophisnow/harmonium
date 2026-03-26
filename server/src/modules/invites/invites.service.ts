import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../utils/errors.js';
import { hasPermission, Permission } from '@harmonium/shared';
import { computeServerPermissions } from '../../utils/permissions.js';
import { addMemberToServer } from '../servers/servers.service.js';
import { isBanned } from '../bans/bans.service.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import type { CreateInviteInput } from './invites.schemas.js';
import { createAuditLogEntry } from '../audit-log/audit-log.service.js';
import { AuditLogAction } from '@harmonium/shared';

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

/** Compute the effective permissions for a user in a server (delegates to centralized util) */
async function getUserServerPermissions(serverId: bigint, userId: bigint): Promise<bigint> {
  const db = getDb();
  return computeServerPermissions(db, serverId.toString(), userId.toString());
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

  // Fire-and-forget audit log
  createAuditLogEntry({
    serverId,
    actorId: inviterId,
    action: AuditLogAction.INVITE_CREATE,
    targetType: 'invite',
    targetId: null,
    changes: { code: { new: code } },
  }).catch(err => console.warn('Failed to write audit log for invite create:', err));

  return inviteToResponse(invite);
}

export async function getInviteInfo(code: string) {
  const db = getDb();

  const [row] = await db
    .select({
      invite: schema.invites,
      server: schema.servers,
    })
    .from(schema.invites)
    .innerJoin(schema.servers, eq(schema.invites.serverId, schema.servers.id))
    .where(eq(schema.invites.code, code));

  if (!row) {
    throw new NotFoundError('Invite not found');
  }

  // Get member count for the server
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.serverId, row.invite.serverId));

  // Round member count to nearest 10, minimum 1
  const exactCount = countResult.count;
  const approximateCount = Math.max(1, Math.round(exactCount / 10) * 10);

  // Return only minimal public information — no inviter details
  return {
    code: row.invite.code,
    server: {
      name: row.server.name,
      iconUrl: row.server.iconUrl,
      approximateMemberCount: approximateCount,
    },
  };
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

  // Check if user is banned (outside transaction — read-only check)
  const serverId = invite.serverId;
  if (await isBanned(serverId.toString(), userId)) {
    throw new ForbiddenError('You are banned from this server');
  }

  // Wrap membership check, use count increment, and member addition in a transaction
  // to prevent race conditions (duplicate memberships, over-counting invite uses)
  const { member, server } = await db.transaction(async (tx) => {
    const userIdBigInt = BigInt(userId);

    // Check if already a member (inside transaction for atomicity)
    const existingMember = await tx.query.serverMembers.findFirst({
      where: and(
        eq(schema.serverMembers.serverId, serverId),
        eq(schema.serverMembers.userId, userIdBigInt),
      ),
    });

    if (existingMember) {
      throw new ConflictError('You are already a member of this server');
    }

    // Re-check max uses inside transaction to prevent race conditions
    const currentInvite = await tx.query.invites.findFirst({
      where: eq(schema.invites.code, code),
    });
    if (currentInvite && currentInvite.maxUses !== null && currentInvite.useCount >= currentInvite.maxUses) {
      throw new ValidationError('Invite has reached its maximum number of uses');
    }

    // Increment use count
    await tx
      .update(schema.invites)
      .set({ useCount: sql`${schema.invites.useCount} + 1` })
      .where(eq(schema.invites.code, code));

    // Add user to server (pass tx so it runs within the transaction)
    const txMember = await addMemberToServer(serverId.toString(), userId, tx);

    // Fetch server data to return
    const txServer = await tx.query.servers.findFirst({
      where: eq(schema.servers.id, serverId),
    });

    return { member: txMember, server: txServer };
  });

  // Publish MEMBER_JOIN after transaction commits successfully
  const pubsub = getPubSubManager();
  await pubsub.publishToServer(serverId.toString(), {
    op: 'MEMBER_JOIN' as const,
    d: { serverId: serverId.toString(), member },
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

  // Fire-and-forget audit log
  createAuditLogEntry({
    serverId,
    actorId: userId,
    action: AuditLogAction.INVITE_DELETE,
    targetType: 'invite',
    targetId: null,
    changes: { code: { old: code } },
  }).catch(err => console.warn('Failed to write audit log for invite delete:', err));
}

export { getUserServerPermissions };

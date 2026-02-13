import { eq } from 'drizzle-orm';
import { hash, verify } from 'argon2';
import { getDb, schema } from '../../db/index.js';
import { ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import type { UserStatus } from '@harmonium/shared';
import type { UpdateUserInput } from './users.schemas.js';

function userToFullResponse(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id.toString(),
    username: user.username,
    discriminator: user.discriminator,
    email: user.email,
    avatarUrl: user.avatarUrl,
    aboutMe: user.aboutMe,
    status: user.status,
    customStatus: user.customStatus,
    theme: user.theme,
    mode: user.mode,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function userToPublicResponse(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id.toString(),
    username: user.username,
    discriminator: user.discriminator,
    avatarUrl: user.avatarUrl,
    aboutMe: user.aboutMe,
    status: user.status as UserStatus,
    customStatus: user.customStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function broadcastUserUpdate(userId: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(userId)),
  });
  if (!user) return;

  // Get all servers the user is in
  const memberships = await db
    .select({ serverId: schema.serverMembers.serverId })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.userId, BigInt(userId)));

  const pubsub = getPubSubManager();
  const publicUser = userToPublicResponse(user);

  for (const { serverId } of memberships) {
    await pubsub.publishToServer(serverId.toString(), {
      op: 'USER_UPDATE' as const,
      d: { user: publicUser },
    });
  }
}

export async function getCurrentUser(userId: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(userId)),
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return userToFullResponse(user);
}

export async function getUserById(userId: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(userId)),
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return userToPublicResponse(user);
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const db = getDb();
  const userIdBigInt = BigInt(userId);

  // Verify user exists
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.id, userIdBigInt),
  });

  if (!existing) {
    throw new NotFoundError('User not found');
  }

  const [updated] = await db
    .update(schema.users)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userIdBigInt))
    .returning();

  await broadcastUserUpdate(userId);

  return userToFullResponse(updated);
}

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  const db = getDb();
  const userIdBigInt = BigInt(userId);

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.id, userIdBigInt),
  });

  if (!existing) {
    throw new NotFoundError('User not found');
  }

  const [updated] = await db
    .update(schema.users)
    .set({
      avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userIdBigInt))
    .returning();

  await broadcastUserUpdate(userId);

  return userToFullResponse(updated);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(userId)),
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isValid = await verify(user.passwordHash, currentPassword);
  if (!isValid) {
    throw new ForbiddenError('Current password is incorrect');
  }

  const newHash = await hash(newPassword);
  await db
    .update(schema.users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(schema.users.id, BigInt(userId)));
}

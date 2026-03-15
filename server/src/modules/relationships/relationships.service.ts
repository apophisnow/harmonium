import { eq, and, or } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import type { Relationship, RelationshipType } from '@harmonium/shared';

function userToPublic(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id.toString(),
    username: user.username,
    discriminator: user.discriminator,
    avatarUrl: user.avatarUrl,
    aboutMe: user.aboutMe,
    status: user.status as 'online' | 'idle' | 'dnd' | 'offline',
    customStatus: user.customStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function toRelationshipResponse(
  row: typeof schema.relationships.$inferSelect,
  user: typeof schema.users.$inferSelect,
): Relationship {
  return {
    user: userToPublic(user),
    type: row.type as RelationshipType,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getRelationships(userId: string): Promise<Relationship[]> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);

  const rows = await db
    .select({
      relationship: schema.relationships,
      user: schema.users,
    })
    .from(schema.relationships)
    .innerJoin(schema.users, eq(schema.relationships.targetId, schema.users.id))
    .where(eq(schema.relationships.userId, userIdBigInt));

  return rows.map((row) => toRelationshipResponse(row.relationship, row.user));
}

export async function sendFriendRequest(
  userId: string,
  targetUsername: string,
  targetDiscriminator: string,
): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);

  // Look up target user
  const targetUser = await db.query.users.findFirst({
    where: and(
      eq(schema.users.username, targetUsername),
      eq(schema.users.discriminator, targetDiscriminator),
    ),
  });

  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  const targetIdBigInt = targetUser.id;

  // Cannot friend yourself
  if (userIdBigInt === targetIdBigInt) {
    throw new ValidationError('You cannot send a friend request to yourself');
  }

  // Check if blocked by target
  const blockedByTarget = await db.query.relationships.findFirst({
    where: and(
      eq(schema.relationships.userId, targetIdBigInt),
      eq(schema.relationships.targetId, userIdBigInt),
      eq(schema.relationships.type, 'blocked'),
    ),
  });

  if (blockedByTarget) {
    throw new ForbiddenError('Cannot send friend request to this user');
  }

  // Check if we blocked the target
  const blockedByUs = await db.query.relationships.findFirst({
    where: and(
      eq(schema.relationships.userId, userIdBigInt),
      eq(schema.relationships.targetId, targetIdBigInt),
      eq(schema.relationships.type, 'blocked'),
    ),
  });

  if (blockedByUs) {
    throw new ForbiddenError('You have blocked this user. Unblock them first.');
  }

  // Check existing relationship
  const existing = await db.query.relationships.findFirst({
    where: and(
      eq(schema.relationships.userId, userIdBigInt),
      eq(schema.relationships.targetId, targetIdBigInt),
    ),
  });

  if (existing) {
    if (existing.type === 'friend') {
      throw new ConflictError('You are already friends with this user');
    }
    if (existing.type === 'pending_outgoing') {
      throw new ConflictError('You have already sent a friend request to this user');
    }
    if (existing.type === 'pending_incoming') {
      // Auto-accept: they already sent us a request
      await acceptFriendRequest(userId, targetIdBigInt.toString());
      return;
    }
  }

  // Get sender user for WS events
  const senderUser = await db.query.users.findFirst({
    where: eq(schema.users.id, userIdBigInt),
  });

  if (!senderUser) {
    throw new NotFoundError('Sender user not found');
  }

  // Insert both rows
  await db.insert(schema.relationships).values([
    { userId: userIdBigInt, targetId: targetIdBigInt, type: 'pending_outgoing' },
    { userId: targetIdBigInt, targetId: userIdBigInt, type: 'pending_incoming' },
  ]);

  // Broadcast to both users
  const pubsub = getPubSubManager();

  await pubsub.publishToUser(userId, {
    op: 'RELATIONSHIP_UPDATE',
    d: {
      relationship: {
        user: userToPublic(targetUser),
        type: 'pending_outgoing',
        createdAt: new Date().toISOString(),
      },
    },
  });

  await pubsub.publishToUser(targetIdBigInt.toString(), {
    op: 'RELATIONSHIP_UPDATE',
    d: {
      relationship: {
        user: userToPublic(senderUser),
        type: 'pending_incoming',
        createdAt: new Date().toISOString(),
      },
    },
  });
}

export async function acceptFriendRequest(userId: string, targetId: string): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const targetIdBigInt = BigInt(targetId);

  // Verify pending_incoming exists
  const incoming = await db.query.relationships.findFirst({
    where: and(
      eq(schema.relationships.userId, userIdBigInt),
      eq(schema.relationships.targetId, targetIdBigInt),
      eq(schema.relationships.type, 'pending_incoming'),
    ),
  });

  if (!incoming) {
    throw new NotFoundError('No pending friend request from this user');
  }

  // Update both rows to 'friend'
  await db
    .update(schema.relationships)
    .set({ type: 'friend' })
    .where(
      and(
        eq(schema.relationships.userId, userIdBigInt),
        eq(schema.relationships.targetId, targetIdBigInt),
      ),
    );

  await db
    .update(schema.relationships)
    .set({ type: 'friend' })
    .where(
      and(
        eq(schema.relationships.userId, targetIdBigInt),
        eq(schema.relationships.targetId, userIdBigInt),
      ),
    );

  // Get both users for WS events
  const [currentUser, targetUser] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, userIdBigInt) }),
    db.query.users.findFirst({ where: eq(schema.users.id, targetIdBigInt) }),
  ]);

  if (!currentUser || !targetUser) return;

  const pubsub = getPubSubManager();

  await pubsub.publishToUser(userId, {
    op: 'RELATIONSHIP_UPDATE',
    d: {
      relationship: {
        user: userToPublic(targetUser),
        type: 'friend',
        createdAt: new Date().toISOString(),
      },
    },
  });

  await pubsub.publishToUser(targetId, {
    op: 'RELATIONSHIP_UPDATE',
    d: {
      relationship: {
        user: userToPublic(currentUser),
        type: 'friend',
        createdAt: new Date().toISOString(),
      },
    },
  });
}

export async function declineFriendRequest(userId: string, targetId: string): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const targetIdBigInt = BigInt(targetId);

  // Verify pending relationship exists (incoming or outgoing)
  const pending = await db.query.relationships.findFirst({
    where: and(
      eq(schema.relationships.userId, userIdBigInt),
      eq(schema.relationships.targetId, targetIdBigInt),
      or(
        eq(schema.relationships.type, 'pending_incoming'),
        eq(schema.relationships.type, 'pending_outgoing'),
      ),
    ),
  });

  if (!pending) {
    throw new NotFoundError('No pending friend request with this user');
  }

  // Delete both rows
  await db
    .delete(schema.relationships)
    .where(
      and(
        eq(schema.relationships.userId, userIdBigInt),
        eq(schema.relationships.targetId, targetIdBigInt),
      ),
    );

  await db
    .delete(schema.relationships)
    .where(
      and(
        eq(schema.relationships.userId, targetIdBigInt),
        eq(schema.relationships.targetId, userIdBigInt),
      ),
    );

  const pubsub = getPubSubManager();

  await pubsub.publishToUser(userId, {
    op: 'RELATIONSHIP_REMOVE',
    d: { userId: targetId },
  });

  await pubsub.publishToUser(targetId, {
    op: 'RELATIONSHIP_REMOVE',
    d: { userId },
  });
}

export async function removeFriend(userId: string, targetId: string): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const targetIdBigInt = BigInt(targetId);

  // Verify friend relationship exists
  const existing = await db.query.relationships.findFirst({
    where: and(
      eq(schema.relationships.userId, userIdBigInt),
      eq(schema.relationships.targetId, targetIdBigInt),
      eq(schema.relationships.type, 'friend'),
    ),
  });

  if (!existing) {
    throw new NotFoundError('You are not friends with this user');
  }

  // Delete both rows
  await db
    .delete(schema.relationships)
    .where(
      and(
        eq(schema.relationships.userId, userIdBigInt),
        eq(schema.relationships.targetId, targetIdBigInt),
      ),
    );

  await db
    .delete(schema.relationships)
    .where(
      and(
        eq(schema.relationships.userId, targetIdBigInt),
        eq(schema.relationships.targetId, userIdBigInt),
      ),
    );

  const pubsub = getPubSubManager();

  await pubsub.publishToUser(userId, {
    op: 'RELATIONSHIP_REMOVE',
    d: { userId: targetId },
  });

  await pubsub.publishToUser(targetId, {
    op: 'RELATIONSHIP_REMOVE',
    d: { userId },
  });
}

export async function blockUser(userId: string, targetId: string): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const targetIdBigInt = BigInt(targetId);

  if (userIdBigInt === targetIdBigInt) {
    throw new ValidationError('You cannot block yourself');
  }

  // Remove any existing relationship from both sides
  await db
    .delete(schema.relationships)
    .where(
      or(
        and(
          eq(schema.relationships.userId, userIdBigInt),
          eq(schema.relationships.targetId, targetIdBigInt),
        ),
        and(
          eq(schema.relationships.userId, targetIdBigInt),
          eq(schema.relationships.targetId, userIdBigInt),
        ),
      ),
    );

  // Insert block row
  await db.insert(schema.relationships).values({
    userId: userIdBigInt,
    targetId: targetIdBigInt,
    type: 'blocked',
  });

  // Get blocked user for WS event
  const blockedUser = await db.query.users.findFirst({
    where: eq(schema.users.id, targetIdBigInt),
  });

  const pubsub = getPubSubManager();

  // Send relationship update to the blocker
  if (blockedUser) {
    await pubsub.publishToUser(userId, {
      op: 'RELATIONSHIP_UPDATE',
      d: {
        relationship: {
          user: userToPublic(blockedUser),
          type: 'blocked',
          createdAt: new Date().toISOString(),
        },
      },
    });
  }

  // Send removal to the blocked user (they see the friend removed)
  await pubsub.publishToUser(targetId, {
    op: 'RELATIONSHIP_REMOVE',
    d: { userId },
  });
}

export async function unblockUser(userId: string, targetId: string): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const targetIdBigInt = BigInt(targetId);

  const existing = await db.query.relationships.findFirst({
    where: and(
      eq(schema.relationships.userId, userIdBigInt),
      eq(schema.relationships.targetId, targetIdBigInt),
      eq(schema.relationships.type, 'blocked'),
    ),
  });

  if (!existing) {
    throw new NotFoundError('You have not blocked this user');
  }

  await db
    .delete(schema.relationships)
    .where(
      and(
        eq(schema.relationships.userId, userIdBigInt),
        eq(schema.relationships.targetId, targetIdBigInt),
      ),
    );

  // Notify the unblocker
  const pubsub = getPubSubManager();
  await pubsub.publishToUser(userId, {
    op: 'RELATIONSHIP_REMOVE',
    d: { userId: targetId },
  });
}

export async function isBlocked(userId: string, targetId: string): Promise<boolean> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const targetIdBigInt = BigInt(targetId);

  const blocked = await db.query.relationships.findFirst({
    where: and(
      or(
        and(
          eq(schema.relationships.userId, userIdBigInt),
          eq(schema.relationships.targetId, targetIdBigInt),
          eq(schema.relationships.type, 'blocked'),
        ),
        and(
          eq(schema.relationships.userId, targetIdBigInt),
          eq(schema.relationships.targetId, userIdBigInt),
          eq(schema.relationships.type, 'blocked'),
        ),
      ),
    ),
  });

  return !!blocked;
}

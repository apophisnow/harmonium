import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { getPubSubManager } from '../../ws/pubsub.js';
import type { DmChannel } from '@harmonium/shared';
import type { PublicUser } from '@harmonium/shared';

// ===== Helpers =====

function userToPublic(user: typeof schema.users.$inferSelect): PublicUser {
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

async function buildDmChannelResponse(
  channel: typeof schema.channels.$inferSelect,
  currentUserId: string,
): Promise<DmChannel> {
  const db = getDb();

  // Get all members of this DM channel
  const members = await db
    .select({
      member: schema.dmChannelMembers,
      user: schema.users,
    })
    .from(schema.dmChannelMembers)
    .innerJoin(schema.users, eq(schema.dmChannelMembers.userId, schema.users.id))
    .where(eq(schema.dmChannelMembers.channelId, channel.id));

  // Get recipients (everyone except the current user)
  const recipients = members
    .filter((m) => m.member.userId.toString() !== currentUserId)
    .map((m) => userToPublic(m.user));

  // Get current user's membership info
  const currentMember = members.find((m) => m.member.userId.toString() === currentUserId);
  const isOpen = currentMember?.member.isOpen ?? true;

  // Get last message ID for this channel
  const lastMessage = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(eq(schema.messages.channelId, channel.id))
    .orderBy(desc(schema.messages.id))
    .limit(1);

  const memberCount = members.length;
  const isDmType = memberCount <= 2 && !channel.ownerId;

  return {
    id: channel.id.toString(),
    type: isDmType ? 'dm' : 'group_dm',
    name: channel.name === '' ? null : channel.name,
    iconUrl: null,
    ownerId: channel.ownerId?.toString() ?? null,
    recipients,
    lastMessageId: lastMessage[0]?.id.toString() ?? null,
    isOpen,
    createdAt: channel.createdAt.toISOString(),
  };
}

// ===== Service Functions =====

export async function createDm(userId: string, recipientId: string): Promise<DmChannel> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const recipientIdBigInt = BigInt(recipientId);

  // Validate recipient exists
  const recipient = await db.query.users.findFirst({
    where: eq(schema.users.id, recipientIdBigInt),
  });
  if (!recipient) {
    throw new NotFoundError('User not found');
  }

  // Check if a 1:1 DM channel already exists between these two users
  // Find channels where both users are members, the channel is a DM, and has no owner (not group)
  const existingChannels = await db
    .select({ channelId: schema.dmChannelMembers.channelId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.userId, userIdBigInt));

  for (const { channelId } of existingChannels) {
    const channel = await db.query.channels.findFirst({
      where: and(
        eq(schema.channels.id, channelId),
        eq(schema.channels.isDm, true),
      ),
    });

    if (!channel || channel.ownerId !== null) continue;

    // Check if recipient is also a member
    const recipientMember = await db.query.dmChannelMembers.findFirst({
      where: and(
        eq(schema.dmChannelMembers.channelId, channelId),
        eq(schema.dmChannelMembers.userId, recipientIdBigInt),
      ),
    });

    if (recipientMember) {
      // Count total members to ensure it's a 1:1 DM (not a group)
      const memberCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.dmChannelMembers)
        .where(eq(schema.dmChannelMembers.channelId, channelId));

      if (memberCount[0].count === 2 || (memberCount[0].count === 1 && userId === recipientId)) {
        // Reopen the DM for the current user
        await db
          .update(schema.dmChannelMembers)
          .set({ isOpen: true })
          .where(
            and(
              eq(schema.dmChannelMembers.channelId, channelId),
              eq(schema.dmChannelMembers.userId, userIdBigInt),
            ),
          );

        return buildDmChannelResponse(channel, userId);
      }
    }
  }

  // Create a new DM channel
  const channelId = generateId();

  await db.insert(schema.channels).values({
    id: channelId,
    serverId: null,
    name: '',
    type: 'text',
    isDm: true,
    ownerId: null,
  });

  // Add both users as members
  const memberValues = [
    {
      channelId,
      userId: userIdBigInt,
      isOpen: true,
    },
  ];

  // For self-DMs, only add one member entry
  if (userId !== recipientId) {
    memberValues.push({
      channelId,
      userId: recipientIdBigInt,
      isOpen: true,
    });
  }

  await db.insert(schema.dmChannelMembers).values(memberValues);

  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelId),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found after creation');
  }

  const dmChannel = await buildDmChannelResponse(channel, userId);

  // Broadcast DM_CHANNEL_CREATE to the recipient
  if (userId !== recipientId) {
    const recipientDmChannel = await buildDmChannelResponse(channel, recipientId);
    const pubsub = getPubSubManager();
    await pubsub.publishToUser(recipientId, {
      op: 'DM_CHANNEL_CREATE',
      d: { channel: recipientDmChannel },
    });
  }

  return dmChannel;
}

export async function createGroupDm(
  ownerId: string,
  recipientIds: string[],
  name?: string,
): Promise<DmChannel> {
  const db = getDb();
  const ownerIdBigInt = BigInt(ownerId);

  // Validate all recipient IDs
  const recipientIdsBigInt = recipientIds.map((id) => BigInt(id));
  const users = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, recipientIdsBigInt));

  if (users.length !== recipientIds.length) {
    throw new ValidationError('One or more recipient IDs are invalid');
  }

  // Create the channel
  const channelId = generateId();

  await db.insert(schema.channels).values({
    id: channelId,
    serverId: null,
    name: name ?? '',
    type: 'text',
    isDm: true,
    ownerId: ownerIdBigInt,
  });

  // Add all participants including the owner
  const allParticipantIds = [ownerIdBigInt, ...recipientIdsBigInt.filter((id) => id !== ownerIdBigInt)];

  await db.insert(schema.dmChannelMembers).values(
    allParticipantIds.map((userId) => ({
      channelId,
      userId,
      isOpen: true,
    })),
  );

  const channel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelId),
  });

  if (!channel) {
    throw new NotFoundError('Channel not found after creation');
  }

  // Broadcast DM_CHANNEL_CREATE to all recipients (not the owner)
  const pubsub = getPubSubManager();
  for (const recipientId of recipientIds) {
    if (recipientId !== ownerId) {
      const recipientDmChannel = await buildDmChannelResponse(channel, recipientId);
      await pubsub.publishToUser(recipientId, {
        op: 'DM_CHANNEL_CREATE',
        d: { channel: recipientDmChannel },
      });
    }
  }

  return buildDmChannelResponse(channel, ownerId);
}

export async function getDmChannels(userId: string): Promise<DmChannel[]> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);

  // Get all DM channel memberships where the user has the DM open
  const memberships = await db
    .select({ channelId: schema.dmChannelMembers.channelId })
    .from(schema.dmChannelMembers)
    .where(
      and(
        eq(schema.dmChannelMembers.userId, userIdBigInt),
        eq(schema.dmChannelMembers.isOpen, true),
      ),
    );

  if (memberships.length === 0) return [];

  // Load all channels
  const channelIds = memberships.map((m) => m.channelId);
  const channels = await db
    .select()
    .from(schema.channels)
    .where(
      and(
        inArray(schema.channels.id, channelIds),
        eq(schema.channels.isDm, true),
      ),
    );

  // Build responses
  const dmChannels: DmChannel[] = [];
  for (const channel of channels) {
    dmChannels.push(await buildDmChannelResponse(channel, userId));
  }

  // Sort by last message ID (most recent first), then by creation date
  dmChannels.sort((a, b) => {
    const aId = a.lastMessageId ? BigInt(a.lastMessageId) : 0n;
    const bId = b.lastMessageId ? BigInt(b.lastMessageId) : 0n;
    if (bId !== aId) return bId > aId ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return dmChannels;
}

export async function closeDm(userId: string, channelId: string): Promise<void> {
  const db = getDb();
  const userIdBigInt = BigInt(userId);
  const channelIdBigInt = BigInt(channelId);

  // Verify membership
  const membership = await db.query.dmChannelMembers.findFirst({
    where: and(
      eq(schema.dmChannelMembers.channelId, channelIdBigInt),
      eq(schema.dmChannelMembers.userId, userIdBigInt),
    ),
  });

  if (!membership) {
    throw new NotFoundError('DM channel not found');
  }

  // Set isOpen to false
  await db
    .update(schema.dmChannelMembers)
    .set({ isOpen: false })
    .where(
      and(
        eq(schema.dmChannelMembers.channelId, channelIdBigInt),
        eq(schema.dmChannelMembers.userId, userIdBigInt),
      ),
    );
}

export async function addGroupDmMember(
  channelId: string,
  ownerId: string,
  userId: string,
): Promise<DmChannel> {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);
  const ownerIdBigInt = BigInt(ownerId);
  const userIdBigInt = BigInt(userId);

  // Get the channel and verify it's a group DM
  const channel = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, channelIdBigInt),
      eq(schema.channels.isDm, true),
    ),
  });

  if (!channel) {
    throw new NotFoundError('DM channel not found');
  }

  if (!channel.ownerId || channel.ownerId !== ownerIdBigInt) {
    throw new ForbiddenError('Only the group DM owner can add members');
  }

  // Check member count
  const memberCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.channelId, channelIdBigInt));

  if (memberCount[0].count >= 10) {
    throw new ValidationError('Group DM cannot have more than 10 members');
  }

  // Validate user exists
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userIdBigInt),
  });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Add or re-open the member
  await db
    .insert(schema.dmChannelMembers)
    .values({
      channelId: channelIdBigInt,
      userId: userIdBigInt,
      isOpen: true,
    })
    .onConflictDoUpdate({
      target: [schema.dmChannelMembers.channelId, schema.dmChannelMembers.userId],
      set: { isOpen: true },
    });

  const dmChannel = await buildDmChannelResponse(channel, ownerId);

  // Broadcast update to all members
  const pubsub = getPubSubManager();
  const members = await db
    .select({ userId: schema.dmChannelMembers.userId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.channelId, channelIdBigInt));

  for (const member of members) {
    const memberUserId = member.userId.toString();
    if (memberUserId === userId) {
      // Send DM_CHANNEL_CREATE to the new member
      const newMemberChannel = await buildDmChannelResponse(channel, memberUserId);
      await pubsub.publishToUser(memberUserId, {
        op: 'DM_CHANNEL_CREATE',
        d: { channel: newMemberChannel },
      });
    } else {
      // Send DM_CHANNEL_UPDATE to existing members
      const memberChannel = await buildDmChannelResponse(channel, memberUserId);
      await pubsub.publishToUser(memberUserId, {
        op: 'DM_CHANNEL_UPDATE',
        d: { channel: memberChannel },
      });
    }
  }

  return dmChannel;
}

export async function leaveGroupDm(channelId: string, userId: string): Promise<void> {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);
  const userIdBigInt = BigInt(userId);

  const channel = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, channelIdBigInt),
      eq(schema.channels.isDm, true),
    ),
  });

  if (!channel) {
    throw new NotFoundError('DM channel not found');
  }

  if (!channel.ownerId) {
    throw new ValidationError('Cannot leave a 1:1 DM. Use close instead.');
  }

  // Remove the member
  await db
    .delete(schema.dmChannelMembers)
    .where(
      and(
        eq(schema.dmChannelMembers.channelId, channelIdBigInt),
        eq(schema.dmChannelMembers.userId, userIdBigInt),
      ),
    );

  // If the leaving user was the owner, transfer ownership
  if (channel.ownerId === userIdBigInt) {
    const remainingMembers = await db
      .select({ userId: schema.dmChannelMembers.userId })
      .from(schema.dmChannelMembers)
      .where(eq(schema.dmChannelMembers.channelId, channelIdBigInt))
      .limit(1);

    if (remainingMembers.length > 0) {
      await db
        .update(schema.channels)
        .set({ ownerId: remainingMembers[0].userId })
        .where(eq(schema.channels.id, channelIdBigInt));
    }
  }

  // Broadcast update to remaining members
  const pubsub = getPubSubManager();
  const remainingMembers = await db
    .select({ userId: schema.dmChannelMembers.userId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.channelId, channelIdBigInt));

  // Refetch channel for potential owner change
  const updatedChannel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (updatedChannel) {
    for (const member of remainingMembers) {
      const memberUserId = member.userId.toString();
      const memberChannel = await buildDmChannelResponse(updatedChannel, memberUserId);
      await pubsub.publishToUser(memberUserId, {
        op: 'DM_CHANNEL_UPDATE',
        d: { channel: memberChannel },
      });
    }
  }
}

export async function updateGroupDm(
  channelId: string,
  userId: string,
  name?: string,
): Promise<DmChannel> {
  const db = getDb();
  const channelIdBigInt = BigInt(channelId);
  const userIdBigInt = BigInt(userId);

  const channel = await db.query.channels.findFirst({
    where: and(
      eq(schema.channels.id, channelIdBigInt),
      eq(schema.channels.isDm, true),
    ),
  });

  if (!channel) {
    throw new NotFoundError('DM channel not found');
  }

  if (!channel.ownerId || channel.ownerId !== userIdBigInt) {
    throw new ForbiddenError('Only the group DM owner can update it');
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (name !== undefined) {
    updateData.name = name;
  }

  await db
    .update(schema.channels)
    .set(updateData)
    .where(eq(schema.channels.id, channelIdBigInt));

  const updatedChannel = await db.query.channels.findFirst({
    where: eq(schema.channels.id, channelIdBigInt),
  });

  if (!updatedChannel) {
    throw new NotFoundError('Channel not found after update');
  }

  const dmChannel = await buildDmChannelResponse(updatedChannel, userId);

  // Broadcast update to all members
  const pubsub = getPubSubManager();
  const members = await db
    .select({ userId: schema.dmChannelMembers.userId })
    .from(schema.dmChannelMembers)
    .where(eq(schema.dmChannelMembers.channelId, channelIdBigInt));

  for (const member of members) {
    const memberUserId = member.userId.toString();
    const memberChannel = await buildDmChannelResponse(updatedChannel, memberUserId);
    await pubsub.publishToUser(memberUserId, {
      op: 'DM_CHANNEL_UPDATE',
      d: { channel: memberChannel },
    });
  }

  return dmChannel;
}

/**
 * Check if a user is a member of a DM channel.
 * Used by permission middleware.
 */
export async function isDmChannelMember(channelId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const membership = await db.query.dmChannelMembers.findFirst({
    where: and(
      eq(schema.dmChannelMembers.channelId, BigInt(channelId)),
      eq(schema.dmChannelMembers.userId, BigInt(userId)),
    ),
  });
  return !!membership;
}

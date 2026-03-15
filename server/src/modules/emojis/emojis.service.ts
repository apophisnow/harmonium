import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import type { CustomEmoji } from '@harmonium/shared';

const MAX_EMOJIS_PER_SERVER = 50;

function emojiToResponse(emoji: typeof schema.emojis.$inferSelect): CustomEmoji {
  return {
    id: emoji.id.toString(),
    serverId: emoji.serverId.toString(),
    name: emoji.name,
    imageUrl: emoji.imageUrl,
    animated: emoji.animated,
    uploadedBy: emoji.uploadedBy.toString(),
    createdAt: emoji.createdAt.toISOString(),
  };
}

export async function getServerEmojis(serverId: string): Promise<CustomEmoji[]> {
  const db = getDb();
  const rows = await db.query.emojis.findMany({
    where: eq(schema.emojis.serverId, BigInt(serverId)),
  });
  return rows.map(emojiToResponse);
}

export async function getEmoji(serverId: string, emojiId: string): Promise<CustomEmoji> {
  const db = getDb();
  const emoji = await db.query.emojis.findFirst({
    where: and(
      eq(schema.emojis.id, BigInt(emojiId)),
      eq(schema.emojis.serverId, BigInt(serverId)),
    ),
  });

  if (!emoji) {
    throw new NotFoundError('Emoji not found');
  }

  return emojiToResponse(emoji);
}

export async function createEmoji(
  serverId: string,
  uploadedBy: string,
  name: string,
  imageUrl: string,
  animated: boolean,
): Promise<CustomEmoji> {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  // Check emoji count limit
  const existing = await db.query.emojis.findMany({
    where: eq(schema.emojis.serverId, serverIdBigInt),
  });

  if (existing.length >= MAX_EMOJIS_PER_SERVER) {
    throw new ValidationError(`Server can have at most ${MAX_EMOJIS_PER_SERVER} custom emojis`);
  }

  // Check for duplicate name in this server
  const duplicate = existing.find((e) => e.name === name);
  if (duplicate) {
    throw new ConflictError(`An emoji with the name "${name}" already exists in this server`);
  }

  const id = generateId();

  const [emoji] = await db
    .insert(schema.emojis)
    .values({
      id,
      serverId: serverIdBigInt,
      name,
      imageUrl,
      animated,
      uploadedBy: BigInt(uploadedBy),
    })
    .returning();

  return emojiToResponse(emoji);
}

export async function renameEmoji(
  serverId: string,
  emojiId: string,
  name: string,
): Promise<CustomEmoji> {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);
  const emojiIdBigInt = BigInt(emojiId);

  // Check emoji exists
  const existing = await db.query.emojis.findFirst({
    where: and(
      eq(schema.emojis.id, emojiIdBigInt),
      eq(schema.emojis.serverId, serverIdBigInt),
    ),
  });

  if (!existing) {
    throw new NotFoundError('Emoji not found');
  }

  // Check for duplicate name
  const duplicate = await db.query.emojis.findFirst({
    where: and(
      eq(schema.emojis.serverId, serverIdBigInt),
      eq(schema.emojis.name, name),
    ),
  });

  if (duplicate && duplicate.id !== emojiIdBigInt) {
    throw new ConflictError(`An emoji with the name "${name}" already exists in this server`);
  }

  const [updated] = await db
    .update(schema.emojis)
    .set({ name })
    .where(eq(schema.emojis.id, emojiIdBigInt))
    .returning();

  return emojiToResponse(updated);
}

export async function deleteEmoji(
  serverId: string,
  emojiId: string,
): Promise<void> {
  const db = getDb();
  const emojiIdBigInt = BigInt(emojiId);
  const serverIdBigInt = BigInt(serverId);

  const existing = await db.query.emojis.findFirst({
    where: and(
      eq(schema.emojis.id, emojiIdBigInt),
      eq(schema.emojis.serverId, serverIdBigInt),
    ),
  });

  if (!existing) {
    throw new NotFoundError('Emoji not found');
  }

  await db.delete(schema.emojis).where(eq(schema.emojis.id, emojiIdBigInt));
}

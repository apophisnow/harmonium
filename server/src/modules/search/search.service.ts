import { eq, and, sql, lt, gt, inArray } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { ForbiddenError } from '../../utils/errors.js';
import type { SearchFilters, SearchResponse, SearchResult, Message, Attachment, Reaction } from '@harmonium/shared';

// ===== Helpers =====

interface MessageRow {
  message: typeof schema.messages.$inferSelect;
  user: typeof schema.users.$inferSelect | null;
}

function attachmentToResponse(row: typeof schema.attachments.$inferSelect): Attachment {
  return {
    id: row.id.toString(),
    messageId: row.messageId.toString(),
    filename: row.filename,
    url: row.url,
    contentType: row.contentType ?? null,
    sizeBytes: row.sizeBytes,
    width: null,
    height: null,
    createdAt: row.createdAt.toISOString(),
  };
}

function messageToResponse(
  row: MessageRow,
  attachmentRows?: (typeof schema.attachments.$inferSelect)[],
  reactions?: Reaction[],
): Message {
  const { message, user } = row;

  return {
    id: message.id.toString(),
    channelId: message.channelId.toString(),
    authorId: message.authorId.toString(),
    content: message.isDeleted ? null : message.content,
    editedAt: message.editedAt?.toISOString() ?? null,
    isDeleted: message.isDeleted,
    replyToId: message.replyToId?.toString() ?? null,
    replyTo: null,
    createdAt: message.createdAt.toISOString(),
    author: user
      ? {
          id: user.id.toString(),
          username: user.username,
          discriminator: user.discriminator,
          avatarUrl: user.avatarUrl,
          aboutMe: user.aboutMe,
          status: user.status as 'online' | 'idle' | 'dnd' | 'offline',
          customStatus: user.customStatus,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }
      : undefined,
    attachments: attachmentRows ? attachmentRows.map(attachmentToResponse) : [],
    reactions: reactions ?? [],
    isPinned: false,
    pinnedAt: null,
    pinnedBy: null,
  };
}

/**
 * Sanitize a search query string for safe use with PostgreSQL to_tsquery.
 * Strips special characters that could break the query syntax.
 */
function sanitizeForTsQuery(query: string): string {
  // Remove characters that are special in tsquery syntax
  return query.replace(/[&|!():*<>'"\\]/g, ' ').trim();
}

/**
 * Build a tsquery string from user input.
 * Splits on whitespace, joins with & (AND), adds :* for prefix matching.
 */
function buildTsQuery(query: string): string {
  const sanitized = sanitizeForTsQuery(query);
  const terms = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term}:*`);

  if (terms.length === 0) return '';
  return terms.join(' & ');
}

// ===== Service Functions =====

export async function searchMessages(
  userId: string,
  filters: SearchFilters,
): Promise<SearchResponse> {
  const db = getDb();

  const tsQuery = buildTsQuery(filters.query);
  if (!tsQuery) {
    return { results: [], totalCount: 0 };
  }

  const userIdBigInt = BigInt(userId);

  // Get all servers the user is a member of
  const memberServers = await db
    .select({ serverId: schema.serverMembers.serverId })
    .from(schema.serverMembers)
    .where(eq(schema.serverMembers.userId, userIdBigInt));

  if (memberServers.length === 0) {
    return { results: [], totalCount: 0 };
  }

  const memberServerIds = memberServers.map((s) => s.serverId);

  // If serverId filter is specified, verify user is a member
  if (filters.serverId) {
    const serverIdBigInt = BigInt(filters.serverId);
    if (!memberServerIds.some((id) => id.toString() === serverIdBigInt.toString())) {
      throw new ForbiddenError('You are not a member of this server');
    }
  }

  // Build conditions
  const conditions = [
    sql`${schema.messages.searchVector} @@ to_tsquery('english', ${tsQuery})`,
    eq(schema.messages.isDeleted, false),
    inArray(schema.channels.serverId, memberServerIds),
  ];

  if (filters.serverId) {
    conditions.push(eq(schema.channels.serverId, BigInt(filters.serverId)));
  }

  if (filters.channelId) {
    conditions.push(eq(schema.messages.channelId, BigInt(filters.channelId)));
  }

  if (filters.authorId) {
    conditions.push(eq(schema.messages.authorId, BigInt(filters.authorId)));
  }

  if (filters.before) {
    conditions.push(lt(schema.messages.createdAt, new Date(filters.before)));
  }

  if (filters.after) {
    conditions.push(gt(schema.messages.createdAt, new Date(filters.after)));
  }

  const limit = filters.limit ?? 25;
  const offset = filters.offset ?? 0;

  // Execute the search query with count
  const rows = await db
    .select({
      message: schema.messages,
      user: schema.users,
      channelName: schema.channels.name,
      serverName: schema.servers.name,
      totalCount: sql<number>`count(*) OVER()`,
      rank: sql<number>`ts_rank(${schema.messages.searchVector}, to_tsquery('english', ${tsQuery}))`,
    })
    .from(schema.messages)
    .innerJoin(schema.channels, eq(schema.messages.channelId, schema.channels.id))
    .innerJoin(schema.servers, eq(schema.channels.serverId, schema.servers.id))
    .innerJoin(schema.users, eq(schema.messages.authorId, schema.users.id))
    .where(and(...conditions))
    .orderBy(
      sql`ts_rank(${schema.messages.searchVector}, to_tsquery('english', ${tsQuery})) DESC`,
      sql`${schema.messages.id} DESC`,
    )
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) {
    return { results: [], totalCount: 0 };
  }

  const totalCount = Number(rows[0].totalCount);

  // Fetch attachments for all result messages
  const messageIds = rows.map((r) => r.message.id);
  const allAttachments = messageIds.length > 0
    ? await db
        .select()
        .from(schema.attachments)
        .where(inArray(schema.attachments.messageId, messageIds))
    : [];

  const attachmentsMap = new Map<string, (typeof schema.attachments.$inferSelect)[]>();
  for (const att of allAttachments) {
    const key = att.messageId.toString();
    const existing = attachmentsMap.get(key);
    if (existing) {
      existing.push(att);
    } else {
      attachmentsMap.set(key, [att]);
    }
  }

  const results: SearchResult[] = rows.map((row) => {
    const msgKey = row.message.id.toString();
    const msgAttachments = attachmentsMap.get(msgKey) ?? [];
    const message = messageToResponse(
      { message: row.message, user: row.user },
      msgAttachments,
    );

    return {
      message,
      channelName: row.channelName,
      serverName: row.serverName,
    };
  });

  return { results, totalCount };
}

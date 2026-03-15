import { eq, and, lt, desc } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import type { AuditLogAction } from '@harmonium/shared';
import type { AuditLogQuery } from './audit-log.schemas.js';

interface CreateAuditLogEntryOptions {
  serverId: string;
  actorId: string;
  action: AuditLogAction;
  targetType?: string | null;
  targetId?: string | null;
  changes?: Record<string, unknown> | null;
  reason?: string | null;
}

function entryToResponse(
  entry: typeof schema.auditLog.$inferSelect,
  actor?: typeof schema.users.$inferSelect,
) {
  return {
    id: entry.id.toString(),
    serverId: entry.serverId.toString(),
    actorId: entry.actorId.toString(),
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId?.toString() ?? null,
    changes: entry.changes as Record<string, unknown> | null,
    reason: entry.reason,
    createdAt: entry.createdAt.toISOString(),
    actor: actor
      ? {
          id: actor.id.toString(),
          username: actor.username,
          discriminator: actor.discriminator,
          avatarUrl: actor.avatarUrl,
        }
      : undefined,
  };
}

export async function createAuditLogEntry(options: CreateAuditLogEntryOptions): Promise<void> {
  const db = getDb();
  const id = generateId();

  await db.insert(schema.auditLog).values({
    id,
    serverId: BigInt(options.serverId),
    actorId: BigInt(options.actorId),
    action: options.action,
    targetType: options.targetType ?? null,
    targetId: options.targetId ? BigInt(options.targetId) : null,
    changes: options.changes ?? null,
    reason: options.reason ?? null,
  });
}

export async function getAuditLog(serverId: string, query: AuditLogQuery) {
  const db = getDb();
  const serverIdBigInt = BigInt(serverId);

  const conditions = [eq(schema.auditLog.serverId, serverIdBigInt)];

  if (query.action) {
    conditions.push(eq(schema.auditLog.action, query.action));
  }

  if (query.before) {
    conditions.push(lt(schema.auditLog.id, BigInt(query.before)));
  }

  const rows = await db
    .select({
      entry: schema.auditLog,
      actor: schema.users,
    })
    .from(schema.auditLog)
    .innerJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.auditLog.id))
    .limit(query.limit);

  return rows.map((row) => entryToResponse(row.entry, row.actor));
}

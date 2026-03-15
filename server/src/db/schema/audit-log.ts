import { pgTable, bigint, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  actorId: bigint('actor_id', { mode: 'bigint' }).notNull().references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId: bigint('target_id', { mode: 'bigint' }),
  changes: jsonb('changes'),
  reason: varchar('reason', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_log_server_id_idx').on(table.serverId),
  index('audit_log_server_id_created_at_idx').on(table.serverId, table.createdAt),
]);

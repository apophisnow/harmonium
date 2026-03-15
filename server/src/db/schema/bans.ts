import { pgTable, bigint, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const bans = pgTable('bans', {
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 512 }),
  bannedBy: bigint('banned_by', { mode: 'bigint' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.serverId, table.userId] }),
]);

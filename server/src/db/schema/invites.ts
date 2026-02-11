import { pgTable, bigint, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const invites = pgTable('invites', {
  code: varchar('code', { length: 10 }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  inviterId: bigint('inviter_id', { mode: 'bigint' }).notNull().references(() => users.id),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('invites_server_id_idx').on(table.serverId),
]);

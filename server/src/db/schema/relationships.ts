import { pgTable, bigint, varchar, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const relationships = pgTable('relationships', {
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: bigint('target_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),  // 'friend', 'pending_outgoing', 'pending_incoming', 'blocked'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.targetId] }),
  index('relationships_user_id_type_idx').on(table.userId, table.type),
]);

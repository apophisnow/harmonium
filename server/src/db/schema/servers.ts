import { pgTable, bigint, varchar, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const servers = pgTable('servers', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  iconUrl: varchar('icon_url', { length: 512 }),
  ownerId: bigint('owner_id', { mode: 'bigint' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const serverMembers = pgTable('server_members', {
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  nickname: varchar('nickname', { length: 32 }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.serverId, table.userId] }),
  index('server_members_user_id_idx').on(table.userId),
]);

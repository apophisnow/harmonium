import { pgTable, bigint, varchar, timestamp, index, primaryKey, boolean, integer, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const servers = pgTable('servers', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  iconUrl: varchar('icon_url', { length: 512 }),
  ownerId: bigint('owner_id', { mode: 'bigint' }).notNull().references(() => users.id),
  defaultTheme: varchar('default_theme', { length: 50 }),
  defaultMode: varchar('default_mode', { length: 10 }),
  isDiscoverable: boolean('is_discoverable').notNull().default(false),
  description: varchar('description', { length: 1000 }),
  categories: text('categories').array().notNull().default([]),
  vanityUrl: varchar('vanity_url', { length: 32 }),
  memberCount: integer('member_count').notNull().default(0),
  bannerUrl: varchar('banner_url', { length: 512 }),
  primaryLanguage: varchar('primary_language', { length: 10 }).notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('servers_discoverable_member_count_idx').on(table.isDiscoverable, table.memberCount),
  uniqueIndex('servers_vanity_url_idx').on(table.vanityUrl),
]);

export const serverMembers = pgTable('server_members', {
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  nickname: varchar('nickname', { length: 32 }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.serverId, table.userId] }),
  index('server_members_user_id_idx').on(table.userId),
]);

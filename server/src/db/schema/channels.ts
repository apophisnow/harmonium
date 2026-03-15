import { pgTable, bigint, varchar, boolean, integer, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const channelCategories = pgTable('channel_categories', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('channel_categories_server_id_idx').on(table.serverId),
]);

export const channels = pgTable('channels', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).references(() => servers.id, { onDelete: 'cascade' }),
  categoryId: bigint('category_id', { mode: 'bigint' }).references(() => channelCategories.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 10 }).notNull().default('text'),
  topic: varchar('topic', { length: 1024 }),
  position: integer('position').notNull().default(0),
  isPrivate: boolean('is_private').notNull().default(false),
  isDm: boolean('is_dm').notNull().default(false),
  ownerId: bigint('owner_id', { mode: 'bigint' }).references(() => users.id),
  // Thread fields
  isThread: boolean('is_thread').notNull().default(false),
  parentChannelId: bigint('parent_channel_id', { mode: 'bigint' }),
  originMessageId: bigint('origin_message_id', { mode: 'bigint' }),
  threadArchived: boolean('thread_archived').notNull().default(false),
  threadArchivedAt: timestamp('thread_archived_at', { withTimezone: true }),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('channels_server_id_idx').on(table.serverId),
  index('channels_parent_channel_id_idx').on(table.parentChannelId),
]);

export const channelPermissionOverrides = pgTable('channel_permission_overrides', {
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 10 }).notNull(),
  targetId: bigint('target_id', { mode: 'bigint' }).notNull(),
  allow: bigint('allow', { mode: 'bigint' }).notNull().default(0n),
  deny: bigint('deny', { mode: 'bigint' }).notNull().default(0n),
}, (table) => [
  primaryKey({ columns: [table.channelId, table.targetType, table.targetId] }),
]);

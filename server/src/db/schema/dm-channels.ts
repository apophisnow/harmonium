import { pgTable, bigint, varchar, boolean, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const dmChannels = pgTable('dm_channels', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dmChannelMembers = pgTable('dm_channel_members', {
  dmChannelId: bigint('dm_channel_id', { mode: 'bigint' }).notNull().references(() => dmChannels.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.dmChannelId, table.userId] }),
  index('dm_channel_members_user_id_idx').on(table.userId),
]);

export const dmMessages = pgTable('dm_messages', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  dmChannelId: bigint('dm_channel_id', { mode: 'bigint' }).notNull().references(() => dmChannels.id, { onDelete: 'cascade' }),
  authorId: bigint('author_id', { mode: 'bigint' }).notNull().references(() => users.id),
  content: varchar('content', { length: 4000 }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('dm_messages_dm_channel_id_id_idx').on(table.dmChannelId, table.id),
]);

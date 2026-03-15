import { pgTable, bigint, boolean, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { channels } from './channels.js';

// DM channels reuse the existing channels table with serverId = null
// This table tracks membership in DM channels
export const dmChannelMembers = pgTable('dm_channel_members', {
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  isOpen: boolean('is_open').notNull().default(true),  // user can "close" a DM without leaving
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.channelId, table.userId] }),
  index('dm_channel_members_user_id_idx').on(table.userId),
]);

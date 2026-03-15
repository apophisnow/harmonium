import { pgTable, bigint, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { channels } from './channels.js';
import { users } from './users.js';

export const threadMembers = pgTable('thread_members', {
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.channelId, table.userId] }),
  index('thread_members_channel_id_idx').on(table.channelId),
  index('thread_members_user_id_idx').on(table.userId),
]);

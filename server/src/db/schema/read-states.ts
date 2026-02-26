import { pgTable, bigint, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { channels } from './channels.js';
import { users } from './users.js';

export const readStates = pgTable('read_states', {
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  lastReadMessageId: bigint('last_read_message_id', { mode: 'bigint' }),
  mentionCount: bigint('mention_count', { mode: 'bigint' }).notNull().default(0n),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.channelId] }),
]);

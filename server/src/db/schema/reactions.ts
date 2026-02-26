import { pgTable, bigint, varchar, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { messages } from './messages.js';
import { users } from './users.js';

export const reactions = pgTable('reactions', {
  messageId: bigint('message_id', { mode: 'bigint' }).notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.userId, table.emoji] }),
  index('reactions_message_id_idx').on(table.messageId),
]);

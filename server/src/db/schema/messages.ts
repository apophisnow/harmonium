import { pgTable, bigint, varchar, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { channels } from './channels.js';
import { users } from './users.js';

export const messages = pgTable('messages', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  authorId: bigint('author_id', { mode: 'bigint' }).notNull().references(() => users.id),
  content: varchar('content', { length: 4000 }),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('messages_channel_id_id_idx').on(table.channelId, table.id),
]);

export const attachments = pgTable('attachments', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  messageId: bigint('message_id', { mode: 'bigint' }).notNull().references(() => messages.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  url: varchar('url', { length: 512 }).notNull(),
  contentType: varchar('content_type', { length: 128 }),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('attachments_message_id_idx').on(table.messageId),
]);

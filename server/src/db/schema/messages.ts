import { pgTable, bigint, varchar, boolean, integer, timestamp, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { channels } from './channels.js';
import { users } from './users.js';

export const messages = pgTable('messages', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  authorId: bigint('author_id', { mode: 'bigint' }).notNull().references(() => users.id),
  content: varchar('content', { length: 4000 }),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
  replyToId: bigint('reply_to_id', { mode: 'bigint' }).references((): AnyPgColumn => messages.id, { onDelete: 'set null' }),
  isPinned: boolean('is_pinned').notNull().default(false),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }),
  pinnedBy: bigint('pinned_by', { mode: 'bigint' }).references(() => users.id),
  webhookId: bigint('webhook_id', { mode: 'bigint' }),
  webhookName: varchar('webhook_name', { length: 80 }),
  webhookAvatarUrl: varchar('webhook_avatar_url', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  searchVector: varchar('search_vector'),  // managed by Postgres, not by app code
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
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('attachments_message_id_idx').on(table.messageId),
]);

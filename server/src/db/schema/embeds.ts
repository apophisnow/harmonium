import { pgTable, bigint, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { messages } from './messages.js';

export const embeds = pgTable('embeds', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  messageId: bigint('message_id', { mode: 'bigint' }).notNull().references(() => messages.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('link'),
  title: varchar('title', { length: 256 }),
  description: text('description'),
  siteName: varchar('site_name', { length: 100 }),
  imageUrl: varchar('image_url', { length: 2048 }),
  imageWidth: integer('image_width'),
  imageHeight: integer('image_height'),
  color: varchar('color', { length: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('embeds_message_id_idx').on(table.messageId),
]);

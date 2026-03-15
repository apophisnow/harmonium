import { pgTable, bigint, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const emojis = pgTable('emojis', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  imageUrl: varchar('image_url', { length: 512 }).notNull(),
  animated: boolean('animated').notNull().default(false),
  uploadedBy: bigint('uploaded_by', { mode: 'bigint' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('emojis_server_id_idx').on(table.serverId),
]);

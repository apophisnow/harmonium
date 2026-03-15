import { pgTable, bigint, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { channels } from './channels.js';
import { users } from './users.js';

export const webhooks = pgTable('webhooks', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  token: varchar('token', { length: 128 }).notNull().unique(),
  createdBy: bigint('created_by', { mode: 'bigint' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('webhooks_server_id_idx').on(table.serverId),
  index('webhooks_channel_id_idx').on(table.channelId),
]);

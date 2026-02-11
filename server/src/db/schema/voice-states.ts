import { pgTable, bigint, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { channels } from './channels.js';
import { servers } from './servers.js';

export const voiceStates = pgTable('voice_states', {
  userId: bigint('user_id', { mode: 'bigint' }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  selfMute: boolean('self_mute').notNull().default(false),
  selfDeaf: boolean('self_deaf').notNull().default(false),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('voice_states_channel_id_idx').on(table.channelId),
]);

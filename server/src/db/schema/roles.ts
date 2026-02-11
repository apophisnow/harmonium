import { pgTable, bigint, varchar, boolean, integer, timestamp, index, primaryKey, foreignKey } from 'drizzle-orm/pg-core';
import { servers, serverMembers } from './servers.js';

export const roles = pgTable('roles', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: integer('color'),
  position: integer('position').notNull().default(0),
  permissions: bigint('permissions', { mode: 'bigint' }).notNull().default(0n),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('roles_server_id_idx').on(table.serverId),
]);

export const memberRoles = pgTable('member_roles', {
  serverId: bigint('server_id', { mode: 'bigint' }).notNull(),
  userId: bigint('user_id', { mode: 'bigint' }).notNull(),
  roleId: bigint('role_id', { mode: 'bigint' }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.serverId, table.userId, table.roleId] }),
  foreignKey({
    columns: [table.serverId, table.userId],
    foreignColumns: [serverMembers.serverId, serverMembers.userId],
  }).onDelete('cascade'),
]);

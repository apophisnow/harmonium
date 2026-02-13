import { pgTable, bigint, varchar, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  username: varchar('username', { length: 32 }).notNull(),
  discriminator: varchar('discriminator', { length: 4 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  aboutMe: varchar('about_me', { length: 2000 }),
  status: varchar('status', { length: 10 }).notNull().default('offline'),
  customStatus: varchar('custom_status', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('users_username_discriminator_idx').on(table.username, table.discriminator),
]);

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('email_verification_tokens_user_id_idx').on(table.userId),
]);

export const refreshTokens = pgTable('refresh_tokens', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revoked: boolean('revoked').notNull().default(false),
}, (table) => [
  index('refresh_tokens_user_id_idx').on(table.userId),
]);

# Task 2: Database Schema + Drizzle ORM Setup

## Objective
Set up Drizzle ORM with PostgreSQL, define all database table schemas in TypeScript, configure drizzle-kit for migrations, and implement the Snowflake ID generator.

## Dependencies
- Task 1 (project scaffolding) - COMPLETE

## Pre-existing Files to Read
- `server/package.json` - Dependencies already listed
- `server/tsconfig.json` - TypeScript config
- `server/src/config.ts` - Environment config (has DATABASE_URL)
- `server/drizzle.config.ts` - Drizzle kit config already exists
- `packages/shared/src/types/*.ts` - Reference for field names and types
- `packages/shared/src/permissions.ts` - DEFAULT_PERMISSIONS constant needed for @everyone role

## Files to Create

### 1. `server/src/db/index.ts` - Database Connection
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '../config.js';
import * as schema from './schema/index.js';

let db: ReturnType<typeof drizzle<typeof schema>>;

export function getDb() {
  if (!db) {
    const config = getConfig();
    const client = postgres(config.DATABASE_URL);
    db = drizzle(client, { schema });
  }
  return db;
}

export type Database = ReturnType<typeof getDb>;
```

### 2. `server/src/db/schema/users.ts` - Users + Refresh Tokens
Define tables:
- `users` table: id (bigint primary key), username (varchar 32, not null), discriminator (varchar 4, not null), email (varchar 255, not null, unique), passwordHash (varchar 255, not null), avatarUrl (varchar 512, nullable), aboutMe (varchar 2000, nullable), status (varchar 10, not null, default 'offline'), customStatus (varchar 128, nullable), createdAt (timestamp with timezone, default now), updatedAt (timestamp with timezone, default now)
  - Unique constraint on (username, discriminator)
- `refreshTokens` table: id (bigint primary key), userId (bigint, references users, cascade delete), tokenHash (varchar 255, not null, unique), expiresAt (timestamp with timezone, not null), createdAt (timestamp with timezone, default now), revoked (boolean, default false)
  - Index on userId

Use Drizzle's pgTable. Use `bigint` mode for snowflake IDs (stored as string in Drizzle). Use `text` for varchar fields or `varchar` with length limits.

### 3. `server/src/db/schema/servers.ts` - Servers + Members
- `servers` table: id (bigint PK), name (varchar 100), iconUrl (varchar 512, nullable), ownerId (bigint, references users), createdAt, updatedAt
- `serverMembers` table: composite PK (serverId, userId), nickname (varchar 32, nullable), joinedAt (timestamp, default now)
  - Foreign keys to servers and users with cascade delete
  - Index on userId

### 4. `server/src/db/schema/roles.ts` - Roles + Member Roles
- `roles` table: id (bigint PK), serverId (bigint, references servers, cascade), name (varchar 100), color (integer, nullable), position (integer, default 0), permissions (bigint, not null, default 0), isDefault (boolean, default false), createdAt
  - Index on serverId
- `memberRoles` table: composite PK (serverId, userId, roleId), foreign key to roles (cascade), composite foreign key to serverMembers (cascade)

### 5. `server/src/db/schema/channels.ts` - Categories + Channels + Permission Overrides
- `channelCategories` table: id (bigint PK), serverId (bigint, references servers, cascade), name (varchar 100), position (integer, default 0), createdAt
  - Index on serverId
- `channels` table: id (bigint PK), serverId (bigint, references servers, cascade), categoryId (bigint, references channelCategories, set null on delete, nullable), name (varchar 100), type (varchar 10, default 'text'), topic (varchar 1024, nullable), position (integer, default 0), isPrivate (boolean, default false), createdAt, updatedAt
  - Index on serverId
- `channelPermissionOverrides` table: composite PK (channelId, targetType, targetId), channelId (bigint, references channels, cascade), targetType (varchar 10, 'role' or 'member'), targetId (bigint), allow (bigint, default 0), deny (bigint, default 0)

### 6. `server/src/db/schema/messages.ts` - Messages + Attachments
- `messages` table: id (bigint PK), channelId (bigint, references channels, cascade), authorId (bigint, references users), content (varchar 4000, nullable), editedAt (timestamp, nullable), isDeleted (boolean, default false), createdAt (timestamp, default now)
  - Index on (channelId, id DESC) - primary query pattern
- `attachments` table: id (bigint PK), messageId (bigint, references messages, cascade), filename (varchar 255), url (varchar 512), contentType (varchar 128, nullable), sizeBytes (integer), createdAt
  - Index on messageId

### 7. `server/src/db/schema/invites.ts` - Invites
- `invites` table: code (varchar 10, primary key), serverId (bigint, references servers, cascade), inviterId (bigint, references users), maxUses (integer, nullable), useCount (integer, default 0), expiresAt (timestamp, nullable), createdAt
  - Index on serverId

### 8. `server/src/db/schema/voice-states.ts` - Voice States
- `voiceStates` table: userId (bigint, PK, references users cascade), channelId (bigint, references channels cascade), serverId (bigint, references servers cascade), selfMute (boolean, default false), selfDeaf (boolean, default false), joinedAt (timestamp, default now)
  - Index on channelId

### 9. `server/src/db/schema/index.ts` - Barrel Export
Re-export all tables and relations from all schema files.

### 10. `server/src/utils/snowflake.ts` - Snowflake ID Generator
Implement a Twitter-style snowflake ID generator:
- Custom epoch: January 1, 2024 (1704067200000)
- Structure: 42 bits timestamp | 5 bits worker | 5 bits process | 12 bits sequence
- Worker ID and process ID default to 0 (single instance)
- Sequence increments within the same millisecond, resets on new millisecond
- Returns bigint
- Export a `generateId()` function and a `snowflakeToTimestamp(id: bigint): Date` function
- Use BigInt throughout, not Number

## Drizzle ORM Patterns to Follow
```typescript
import { pgTable, bigint, varchar, boolean, timestamp, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

// For bigint snowflake IDs, use: bigint('id', { mode: 'bigint' }).primaryKey()
// For bigint permissions, use: bigint('permissions', { mode: 'bigint' }).notNull().default(0n)
// For timestamps: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
```

## Acceptance Criteria
- [ ] All 8 schema files + barrel export created
- [ ] All tables match the database design (correct columns, types, constraints)
- [ ] Foreign keys with correct cascade behavior
- [ ] Indexes on all frequently queried columns
- [ ] Snowflake ID generator produces unique, sortable 64-bit IDs
- [ ] `snowflakeToTimestamp` correctly extracts timestamp from ID
- [ ] All files pass TypeScript compilation (`npx tsc --noEmit` in server/)
- [ ] `npx drizzle-kit generate` produces a valid migration file

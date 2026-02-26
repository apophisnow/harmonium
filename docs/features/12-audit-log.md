# 12 — Audit Log

## Summary

Track all administrative and moderation actions in a server. Server admins can view a chronological log of who did what. Similar to Discord's audit log.

## Database Changes

### Create `server/src/db/schema/audit-log.ts`

```typescript
import { pgTable, bigint, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  actorId: bigint('actor_id', { mode: 'bigint' }).notNull().references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),  // action type enum
  targetType: varchar('target_type', { length: 20 }).notNull(),  // 'server', 'channel', 'role', 'member', 'invite', 'emoji'
  targetId: varchar('target_id', { length: 50 }),  // ID of affected entity
  changes: jsonb('changes'),   // { before: {...}, after: {...} } for updates
  reason: varchar('reason', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_log_server_id_idx').on(table.serverId, table.id),
  index('audit_log_actor_id_idx').on(table.actorId),
  index('audit_log_action_idx').on(table.serverId, table.action),
]);
```

### Action types

```typescript
// Define in packages/shared/src/types/audit-log.ts
export const AuditLogAction = {
  // Server
  SERVER_UPDATE: 'SERVER_UPDATE',

  // Channels
  CHANNEL_CREATE: 'CHANNEL_CREATE',
  CHANNEL_UPDATE: 'CHANNEL_UPDATE',
  CHANNEL_DELETE: 'CHANNEL_DELETE',

  // Roles
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_UPDATE: 'ROLE_UPDATE',
  ROLE_DELETE: 'ROLE_DELETE',
  MEMBER_ROLE_ADD: 'MEMBER_ROLE_ADD',
  MEMBER_ROLE_REMOVE: 'MEMBER_ROLE_REMOVE',

  // Members
  MEMBER_KICK: 'MEMBER_KICK',
  MEMBER_BAN: 'MEMBER_BAN',
  MEMBER_UNBAN: 'MEMBER_UNBAN',

  // Invites
  INVITE_CREATE: 'INVITE_CREATE',
  INVITE_DELETE: 'INVITE_DELETE',

  // Emoji
  EMOJI_CREATE: 'EMOJI_CREATE',
  EMOJI_DELETE: 'EMOJI_DELETE',
  EMOJI_UPDATE: 'EMOJI_UPDATE',

  // Messages (mod actions only)
  MESSAGE_PIN: 'MESSAGE_PIN',
  MESSAGE_UNPIN: 'MESSAGE_UNPIN',
  MESSAGE_DELETE: 'MESSAGE_DELETE',  // when a mod deletes another user's message
} as const;
```

## Shared Types

### Create `packages/shared/src/types/audit-log.ts`

```typescript
import type { PublicUser } from './user.js';

export interface AuditLogEntry {
  id: string;
  serverId: string;
  actor: PublicUser;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, { before: unknown; after: unknown }> | null;
  reason: string | null;
  createdAt: string;
}
```

## API Changes

### Create `server/src/modules/audit-log/`

**`audit-log.service.ts`:**

Core function used by all other modules:

```typescript
export async function createAuditLogEntry(params: {
  serverId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  reason?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(schema.auditLog).values({
    id: generateId(),
    serverId: BigInt(params.serverId),
    actorId: BigInt(params.actorId),
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId ?? null,
    changes: params.changes ?? null,
    reason: params.reason ?? null,
  });
}
```

Query function:

```typescript
export async function getAuditLog(serverId: string, filters?: {
  actorId?: string;
  action?: string;
  before?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  // Cursor-based pagination using snowflake ID
  // Join with users table for actor info
  // Filter by action type if provided
  // Default limit: 50
}
```

**`audit-log.routes.ts`:**

```
GET /api/servers/:serverId/audit-log    — view audit log (requires MANAGE_SERVER or ADMINISTRATOR)
```

Query params: `?action=MEMBER_BAN&actorId=...&before=...&limit=50`

### Integration with existing modules

Add `createAuditLogEntry()` calls to existing service functions. Examples:

**`servers.service.ts` → `updateServer()`:**
```typescript
await createAuditLogEntry({
  serverId, actorId: userId, action: 'SERVER_UPDATE',
  targetType: 'server', targetId: serverId,
  changes: { name: { before: oldName, after: newName } },
});
```

**`channels.service.ts` → `createChannel()`:**
```typescript
await createAuditLogEntry({
  serverId, actorId: userId, action: 'CHANNEL_CREATE',
  targetType: 'channel', targetId: channelId,
});
```

**`bans.service.ts` → `banMember()`:**
```typescript
await createAuditLogEntry({
  serverId, actorId: bannedBy, action: 'MEMBER_BAN',
  targetType: 'member', targetId: userId,
  reason,
});
```

Add similar calls to: deleteChannel, updateChannel, createRole, updateRole, deleteRole, assignRole, removeRole, kickMember, createInvite, deleteInvite, pinMessage, unpinMessage, and mod-initiated message deletes.

## Frontend Changes

### Create `client/src/api/audit-log.ts`

```typescript
export async function getAuditLog(serverId: string, filters?: {
  action?: string;
  actorId?: string;
  before?: string;
  limit?: number;
}): Promise<AuditLogEntry[]>;
```

### Add "Audit Log" tab to server settings

**Create `client/src/components/server/AuditLog.tsx`:**

- List of audit log entries, newest first
- Each entry shows:
  - Actor avatar + username
  - Action description (human-readable, e.g., "**User** banned **TargetUser**")
  - Changes detail (expandable, showing before/after values)
  - Reason (if provided)
  - Timestamp (relative, e.g., "2 hours ago")
- Filter dropdown by action type
- Infinite scroll pagination
- Empty state: "No audit log entries"

### Action descriptions

Map action types to human-readable descriptions:

```typescript
const actionDescriptions = {
  SERVER_UPDATE: (entry) => `updated the server settings`,
  CHANNEL_CREATE: (entry) => `created channel #${entry.changes?.name?.after}`,
  MEMBER_BAN: (entry) => `banned a member`,
  ROLE_UPDATE: (entry) => `updated role ${entry.changes?.name?.after || entry.changes?.name?.before}`,
  // ... etc
};
```

## Edge Cases

- Audit log retention: keep entries for 90 days, then auto-delete (optional, via a scheduled job)
- Bulk deletes: if deleting multiple messages, create one audit entry with count
- Actor deleted their account: show "Deleted User" with the actor ID
- Changes field: only store fields that actually changed, not the full object
- Permission check: only users with MANAGE_SERVER or ADMINISTRATOR can view audit log
- Pagination: use cursor-based pagination (before=snowflakeId) for consistency

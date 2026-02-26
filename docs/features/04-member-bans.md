# 04 — Member Bans

## Summary

Allow server moderators to ban members, preventing them from rejoining. Includes ban list management and an optional message purge on ban.

## Database Changes

### Create `server/src/db/schema/bans.ts`

```typescript
import { pgTable, bigint, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const bans = pgTable('bans', {
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 512 }),
  bannedBy: bigint('banned_by', { mode: 'bigint' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.serverId, table.userId] }),
]);
```

### Export from `server/src/db/schema/index.ts`

## Shared Types

### Create `packages/shared/src/types/ban.ts`

```typescript
import type { PublicUser } from './user.js';

export interface Ban {
  serverId: string;
  user: PublicUser;
  reason: string | null;
  bannedBy: string;
  createdAt: string;
}
```

### Modify `packages/shared/src/ws-events.ts`

Add S2C event:

```typescript
export interface MemberBanEvent {
  op: 'MEMBER_BAN';
  d: { serverId: string; userId: string };
}
```

Add to `ServerEvent` union.

## API Changes

### Create `server/src/modules/bans/`

**`bans.schemas.ts`:**

```typescript
export const banMemberSchema = z.object({
  reason: safeText(z.string().max(512)).optional(),
  purgeMessages: z.boolean().optional().default(false),  // delete recent messages from banned user
});
```

**`bans.service.ts`:**

- `banMember(serverId, userId, bannedBy, reason, purgeMessages)`:
  1. Check that the target is not the server owner
  2. Check that the banner has a higher role than the target (role hierarchy)
  3. Insert into `bans` table
  4. Remove from `server_members`
  5. If `purgeMessages`: soft-delete messages from the user in this server's channels (last 24h)
  6. Broadcast `MEMBER_BAN` and `MEMBER_LEAVE` events
- `unbanMember(serverId, userId)`:
  1. Delete from `bans` table
- `getBans(serverId)`:
  1. Fetch all bans with user data
- `isBanned(serverId, userId)`:
  1. Check if a ban record exists (used during invite acceptance)

**`bans.routes.ts`:**

```
PUT    /api/servers/:serverId/bans/:userId    — ban member (requires BAN_MEMBERS)
DELETE /api/servers/:serverId/bans/:userId    — unban member (requires BAN_MEMBERS)
GET    /api/servers/:serverId/bans            — list bans (requires BAN_MEMBERS)
```

### Modify `server/src/modules/invites/invites.service.ts`

In `acceptInvite`, check `isBanned(serverId, userId)` before allowing the user to join. Return 403 if banned.

## WebSocket Changes

### Create `server/src/ws/handlers/ban.handler.ts`

```typescript
export function broadcastMemberBan(pubsub, serverId, userId) {
  pubsub.publishToServer(serverId, { op: 'MEMBER_BAN', d: { serverId, userId } });
}
```

### Handle `MEMBER_BAN` on the client WS

When the banned user receives a `MEMBER_BAN` event where `userId` matches their own:
- Remove the server from their server list
- Close the WebSocket subscription for that server
- Show a toast: "You have been banned from **ServerName**"

## Frontend Changes

### Create `client/src/api/bans.ts`

```typescript
export async function banMember(serverId, userId, reason?, purgeMessages?): Promise<void>;
export async function unbanMember(serverId, userId): Promise<void>;
export async function getBans(serverId): Promise<Ban[]>;
```

### Modify `client/src/components/member/MemberContextMenu.tsx`

Add "Ban Member" option (visible if current user has BAN_MEMBERS permission):
- Opens a confirmation modal with optional reason field and "Purge recent messages" checkbox

### Create ban management in server settings

Add a "Bans" tab to the server settings panel (`client/src/components/server/ServerSettings.tsx`):
- List banned users with reason and ban date
- "Unban" button for each entry

## Edge Cases

- Cannot ban the server owner
- Cannot ban someone with a higher or equal role
- Cannot ban yourself
- Banning a user who is currently in a voice channel: disconnect them from voice first
- Re-banning an already banned user: upsert (update reason)
- Ban check on every invite accept and server join attempt

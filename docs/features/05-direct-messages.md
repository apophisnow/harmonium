# 05 — Direct Messages & Group DMs

## Summary

Private conversations between users, independent of any server. Supports 1-on-1 DMs and group DMs (up to 10 participants). DM channels appear in a dedicated section of the UI alongside the server list.

## Database Changes

### Create `server/src/db/schema/dm-channels.ts`

```typescript
import { pgTable, bigint, varchar, boolean, integer, timestamp, index, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { channels } from './channels.js';

// DM channels reuse the existing channels table with serverId = null
// This table tracks membership in DM channels
export const dmChannelMembers = pgTable('dm_channel_members', {
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  isOpen: boolean('is_open').notNull().default(true),  // user can "close" a DM without leaving
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.channelId, table.userId] }),
  index('dm_channel_members_user_id_idx').on(table.userId),
]);
```

### Modify `server/src/db/schema/channels.ts`

Make `serverId` nullable on the channels table:

```typescript
serverId: bigint('server_id', { mode: 'bigint' }).references(() => servers.id, { onDelete: 'cascade' }),
// Remove .notNull() — DM channels have no server
```

Add new fields to channels:

```typescript
isDm: boolean('is_dm').notNull().default(false),
ownerId: bigint('owner_id', { mode: 'bigint' }).references(() => users.id),  // group DM owner
```

### Migration

- Alter `channels.server_id` to be nullable
- Add `is_dm` and `owner_id` columns
- Create `dm_channel_members` table

## Shared Types

### Create `packages/shared/src/types/dm.ts`

```typescript
import type { PublicUser } from './user.js';

export interface DmChannel {
  id: string;
  type: 'dm' | 'group_dm';
  name: string | null;           // null for 1:1 DMs (display other user's name), set for group DMs
  iconUrl: string | null;        // group DM icon
  ownerId: string | null;        // group DM owner
  recipients: PublicUser[];      // other participants (not including self)
  lastMessageId: string | null;  // for sorting by recent activity
  isOpen: boolean;               // whether the current user has this DM "open"
  createdAt: string;
}
```

### Modify `packages/shared/src/ws-events.ts`

Add new events:

```typescript
// C2S
export interface SubscribeDmEvent {
  op: 'SUBSCRIBE_DM';
  d: { channelId: string };
}

// S2C
export interface DmChannelCreateEvent {
  op: 'DM_CHANNEL_CREATE';
  d: { channel: DmChannel };
}

export interface DmChannelUpdateEvent {
  op: 'DM_CHANNEL_UPDATE';
  d: { channel: DmChannel };
}
```

Add to respective union types.

## API Changes

### Create `server/src/modules/dm/`

**`dm.schemas.ts`:**

```typescript
export const createDmSchema = z.object({
  recipientId: snowflakeId,  // for 1:1 DM
});

export const createGroupDmSchema = z.object({
  name: safeText(z.string().min(1).max(100)).optional(),
  recipientIds: z.array(snowflakeId).min(1).max(9),  // +self = max 10
});

export const updateGroupDmSchema = z.object({
  name: safeText(z.string().min(1).max(100)).optional(),
});
```

**`dm.service.ts`:**

- `createDm(userId, recipientId)`:
  1. Check if a 1:1 DM channel already exists between these two users
  2. If yes, reopen it (set `isOpen = true`) and return it
  3. If no, create a new channel (isDm=true, serverId=null) and add both users as members
  4. Broadcast `DM_CHANNEL_CREATE` to the recipient via their user-scoped WS subscription

- `createGroupDm(ownerId, name, recipientIds)`:
  1. Validate all recipient IDs are valid users
  2. Create channel with isDm=true, ownerId, name
  3. Add all participants as members
  4. Broadcast `DM_CHANNEL_CREATE` to all recipients

- `getDmChannels(userId)`:
  1. Fetch all DM channels where user is a member and `isOpen = true`
  2. Include recipient info and last message ID
  3. Sort by most recent message

- `closeDm(userId, channelId)`:
  1. Set `isOpen = false` for this user in `dm_channel_members`
  2. Does NOT remove them from the DM — they can reopen it

- `addGroupDmMember(channelId, ownerId, userId)` — owner adds a member
- `leaveGroupDm(channelId, userId)` — remove self from group DM

**`dm.routes.ts`:**

```
POST   /api/dm/channels                        — create 1:1 DM
POST   /api/dm/channels/group                  — create group DM
GET    /api/dm/channels                        — list user's open DM channels
DELETE /api/dm/channels/:channelId             — close DM (hide from list)
PUT    /api/dm/channels/:channelId/members/:userId    — add member to group DM
DELETE /api/dm/channels/:channelId/members/@me        — leave group DM
PATCH  /api/dm/channels/:channelId             — update group DM (name, icon)
```

### Messages in DMs

DM channels reuse the existing messages system. The existing `POST/GET /api/channels/:channelId/messages` endpoints work for DM channels — just need to update permission checks:
- For DM channels, check that the user is a member of the DM channel (instead of checking server permissions)
- Modify the permission middleware to handle DM channels (serverId is null)

## WebSocket Changes

### User-scoped subscriptions

DM events need to reach users regardless of which server they're viewing. Two approaches:

**Approach: User-scoped pub/sub channel**

When a user connects via WebSocket, automatically subscribe them to `user:{userId}` in Redis pub/sub. DM events are published to all participants' user channels.

```typescript
// In WS gateway, after IDENTIFY:
pubsub.subscribeToUser(userId);

// In DM service, when sending a message:
for (const memberId of dmMembers) {
  pubsub.publishToUser(memberId, { op: 'MESSAGE_CREATE', d: { message } });
}
```

Add to `PubSubManager`:
- `subscribeToUser(userId)` / `unsubscribeFromUser(userId)`
- `publishToUser(userId, event)`

## Frontend Changes

### Create `client/src/stores/dm.store.ts`

```typescript
interface DmState {
  dmChannels: DmChannel[];
  currentDmChannelId: string | null;

  fetchDmChannels: () => Promise<void>;
  openDm: (userId: string) => Promise<DmChannel>;  // create or reopen
  closeDm: (channelId: string) => Promise<void>;
  addDmChannel: (channel: DmChannel) => void;       // from WS event
  setCurrentDmChannel: (channelId: string | null) => void;
}
```

### Create `client/src/api/dm.ts`

API client functions matching the routes above.

### UI Changes

**Modify `client/src/components/layout/ServerSidebar.tsx`:**
- Add a "Home" / DM icon at the top of the server list (above servers)
- Clicking it switches to the DM view
- Show unread indicator if any DM has unreads

**Create `client/src/components/dm/DmSidebar.tsx`:**
- Replaces the channel sidebar when in DM mode
- Lists open DM channels sorted by recent activity
- Each item shows: recipient avatar, name, last message preview (optional)
- X button to close a DM
- "New DM" button at the top

**Create `client/src/components/dm/DmHeader.tsx`:**
- Shows recipient name(s) and online status
- For group DMs: shows group name or list of members

**Reuse existing chat components:**
- `MessageList`, `MessageInput`, `MessageItem` all work for DM channels
- The message store already keys by channelId, so DM messages are handled naturally

**Modify `client/src/components/member/MemberContextMenu.tsx`:**
- Add "Message" option to user context menus to start a 1:1 DM

### Navigation State

Add to `client/src/stores/ui.store.ts` or `server.store.ts`:

```typescript
viewMode: 'server' | 'dm';
setViewMode: (mode: 'server' | 'dm') => void;
```

The main layout conditionally renders server channels or DM list based on `viewMode`.

## Edge Cases

- Starting a DM with yourself: allow it (Discord allows this as a personal notepad)
- Blocking (future feature): blocked users can't create new DMs
- DM with a user who has been deleted: show "Deleted User" as name
- Group DM with 1 person left: still functions (they can add more people)
- Group DM owner leaves: transfer ownership to the next member
- Message permissions in DMs: all members can send/read, no role checks
- Rate limiting: limit DM channel creation to prevent spam
- Maximum open DMs: no hard limit, but sort by recent activity and paginate if needed

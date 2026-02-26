# 06 — Friends System

## Summary

Users can send friend requests, accept/decline them, and manage a friends list. Friends can easily start DMs and see each other's online status. Includes user blocking.

## Database Changes

### Create `server/src/db/schema/relationships.ts`

```typescript
import { pgTable, bigint, varchar, timestamp, primaryKey, index, check } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { sql } from 'drizzle-orm';

export const relationships = pgTable('relationships', {
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: bigint('target_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),  // 'friend', 'pending_outgoing', 'pending_incoming', 'blocked'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.targetId] }),
  index('relationships_user_id_type_idx').on(table.userId, table.type),
]);
```

**Relationship types (from `userId`'s perspective):**
- `friend` — mutual friends (both rows exist)
- `pending_outgoing` — userId sent a request to targetId
- `pending_incoming` — userId received a request from targetId
- `blocked` — userId blocked targetId

When a friend request is accepted, both rows change to `friend`. This means:
- User A has row: `(A, B, 'friend')`
- User B has row: `(B, A, 'friend')`

## Shared Types

### Create `packages/shared/src/types/relationship.ts`

```typescript
import type { PublicUser } from './user.js';

export type RelationshipType = 'friend' | 'pending_outgoing' | 'pending_incoming' | 'blocked';

export interface Relationship {
  user: PublicUser;
  type: RelationshipType;
  createdAt: string;
}
```

### Modify `packages/shared/src/ws-events.ts`

Add S2C events:

```typescript
export interface RelationshipUpdateEvent {
  op: 'RELATIONSHIP_UPDATE';
  d: { relationship: Relationship };
}

export interface RelationshipRemoveEvent {
  op: 'RELATIONSHIP_REMOVE';
  d: { userId: string };
}
```

Add to `ServerEvent` union.

## API Changes

### Create `server/src/modules/relationships/`

**`relationships.schemas.ts`:**

```typescript
export const sendFriendRequestSchema = z.object({
  username: z.string().min(1),
  discriminator: z.string().min(4).max(4),
});
```

**`relationships.service.ts`:**

- `sendFriendRequest(userId, targetUsername, targetDiscriminator)`:
  1. Look up target user by username#discriminator
  2. Check not already friends, not blocked by target, not self
  3. Insert `(userId, targetId, 'pending_outgoing')` and `(targetId, userId, 'pending_incoming')`
  4. Broadcast `RELATIONSHIP_UPDATE` to both users

- `acceptFriendRequest(userId, targetId)`:
  1. Verify a pending_incoming relationship exists
  2. Update both rows to `friend`
  3. Broadcast `RELATIONSHIP_UPDATE` to both users

- `declineFriendRequest(userId, targetId)`:
  1. Verify a pending_incoming relationship exists
  2. Delete both rows
  3. Broadcast `RELATIONSHIP_REMOVE` to both

- `removeFriend(userId, targetId)`:
  1. Delete both friend rows
  2. Broadcast `RELATIONSHIP_REMOVE` to both

- `blockUser(userId, targetId)`:
  1. Remove any existing relationship
  2. Insert `(userId, targetId, 'blocked')`
  3. Broadcast `RELATIONSHIP_REMOVE` to targetId (they see the friend removed)

- `unblockUser(userId, targetId)`:
  1. Delete the blocked row

- `getRelationships(userId)`:
  1. Fetch all relationships with user data
  2. Return categorized by type

- `isBlocked(userId, targetId)`:
  1. Check if either user has blocked the other (used in DM creation, friend requests, etc.)

**`relationships.routes.ts`:**

```
GET    /api/relationships                          — list all relationships
POST   /api/relationships/friends                  — send friend request (by username#discriminator)
PUT    /api/relationships/friends/:userId           — accept friend request
DELETE /api/relationships/friends/:userId           — remove friend or decline request
PUT    /api/relationships/blocks/:userId            — block user
DELETE /api/relationships/blocks/:userId            — unblock user
```

### Integration with DMs (Feature 05)

Modify DM creation to check `isBlocked()` — if either user has blocked the other, reject the DM creation with 403.

### Integration with Messages

In `createMessage` for DM channels, check if the sender is blocked by any recipient. If blocked, silently succeed but don't deliver (or reject with 403 — choose one).

## Frontend Changes

### Create `client/src/stores/relationship.store.ts`

```typescript
interface RelationshipState {
  relationships: Map<string, Relationship>;  // key: targetUserId

  fetchRelationships: () => Promise<void>;
  sendFriendRequest: (username: string, discriminator: string) => Promise<void>;
  acceptFriendRequest: (userId: string) => Promise<void>;
  declineFriendRequest: (userId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;

  isFriend: (userId: string) => boolean;
  isBlocked: (userId: string) => boolean;
}
```

### Create `client/src/api/relationships.ts`

API client functions matching the routes.

### UI Changes

**Create `client/src/components/friends/FriendsPage.tsx`:**

Displayed when in DM mode with no DM channel selected. Has tabs:
- **Online** — friends currently online
- **All** — all friends
- **Pending** — incoming and outgoing requests
- **Blocked** — blocked users

Each friend row shows: avatar, username#discriminator, status, action buttons (Message, Remove, Block).

Pending incoming requests show: Accept / Decline buttons.

**Create `client/src/components/friends/AddFriend.tsx`:**
- Input field for "Username#0000" format
- "Send Friend Request" button
- Success/error feedback

**Modify `client/src/components/dm/DmSidebar.tsx`:**
- Add "Friends" item at the top that navigates to FriendsPage

**Modify `client/src/components/member/MemberContextMenu.tsx`:**
- Add "Add Friend" / "Remove Friend" based on relationship status
- Add "Block" option

**Modify `client/src/components/member/UserCard.tsx`:**
- Show "Add Friend" / "Friends" / "Pending" badge based on relationship
- Show "Block" option

## Edge Cases

- Sending a friend request to someone who already sent you one: auto-accept
- Blocking a friend: removes friendship first, then blocks
- Blocking someone who sent you a request: removes the request, then blocks
- Unblocking does NOT restore friendship
- Max friends: no hard limit initially
- Friend request to invalid username#discriminator: return 404 with "User not found"
- Rate limit friend requests: 10 per minute per user

# 03 — Unread Tracking & Mentions

## Summary

Track which messages each user has read per channel. Show unread indicators on channels and servers. Support @mentions that generate notifications.

## Database Changes

### Create `server/src/db/schema/read-states.ts`

```typescript
import { pgTable, bigint, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { channels } from './channels.js';
import { users } from './users.js';

export const readStates = pgTable('read_states', {
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  lastReadMessageId: bigint('last_read_message_id', { mode: 'bigint' }),  // snowflake of last read message
  mentionCount: bigint('mention_count', { mode: 'bigint' }).notNull().default(0n),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.channelId] }),
]);
```

- `lastReadMessageId` is a snowflake — since snowflakes are time-ordered, any message with a larger ID is unread.
- `mentionCount` tracks how many unread mentions the user has in this channel.

### Export from `server/src/db/schema/index.ts`

## Shared Types

### Create `packages/shared/src/types/read-state.ts`

```typescript
export interface ReadState {
  channelId: string;
  lastReadMessageId: string | null;
  mentionCount: number;
}

export interface UnreadInfo {
  channelId: string;
  hasUnread: boolean;
  mentionCount: number;
}
```

### Modify `packages/shared/src/ws-events.ts`

Add to the `ReadyEvent` data:

```typescript
readStates: ReadState[];  // initial read states for all channels in subscribed servers
```

Add new C2S event:

```typescript
export interface MarkReadEvent {
  op: 'MARK_READ';
  d: { channelId: string; messageId: string };
}
```

Add to `ClientEvent` union.

## API Changes

### Create `server/src/modules/read-states/`

**`read-states.service.ts`:**

- `getReadStates(userId, serverIds)` — fetch all read states for a user across servers
- `markRead(userId, channelId, messageId)` — upsert read state, reset mention count
- `incrementMentionCount(channelId, userIds)` — increment mention count for mentioned users

**`read-states.routes.ts`:**

```
POST /api/channels/:channelId/read-state    — mark channel as read up to a messageId
GET  /api/servers/:serverId/read-states      — get read states for all channels in a server
```

### Modify `server/src/modules/messages/messages.service.ts`

In `createMessage`, after broadcasting:
- Parse message content for mentions: `<@userId>` pattern
- If `@everyone` is used (and user has MENTION_EVERYONE permission), increment mention count for all members
- For individual mentions, call `incrementMentionCount` for mentioned user IDs

### Mention format in message content

Use Discord's format: `<@userId>` for user mentions. The frontend renders these as styled @username pills.

## WebSocket Changes

### Handle `MARK_READ` C2S event

In the WS gateway handler:
- Call `markRead(userId, channelId, messageId)`
- No broadcast needed — read state is private to the user

### Modify the `READY` event handler

Include `readStates` in the READY payload so the client has initial unread state.

## Frontend Changes

### Create `client/src/stores/unread.store.ts`

```typescript
interface UnreadState {
  readStates: Map<string, ReadState>;  // key: channelId

  setReadStates: (states: ReadState[]) => void;
  markRead: (channelId: string, messageId: string) => void;
  handleNewMessage: (channelId: string, messageId: string, mentions: string[], currentUserId: string) => void;
  getUnreadInfo: (channelId: string, latestMessageId?: string) => UnreadInfo;
  getServerUnreadInfo: (serverId: string, channelIds: string[]) => { hasUnread: boolean; mentionCount: number };
}
```

### Modify `client/src/components/layout/ChannelSidebar.tsx`

For each channel item:
- If unread: show the channel name in **bold** with a small white dot indicator on the left
- If mentions > 0: show a red badge with the mention count on the right

### Modify `client/src/components/layout/ServerSidebar.tsx`

For each server icon:
- If any channel in the server has unreads: show a small white pill indicator on the left of the server icon
- If any channel has mentions: show a red badge with total mention count on the bottom-right corner of the server icon

### Modify `client/src/components/chat/MessageList.tsx`

- When the user scrolls to the bottom or the channel is focused with new messages visible, send a `MARK_READ` WS event with the latest message ID
- Show an "unread messages" divider line between the last read message and the first unread message (a thin line with "New" label)

### Modify `client/src/components/chat/MessageInput.tsx`

- Add mention autocomplete: when the user types `@`, show a dropdown of server members
- Insert `<@userId>` into the message content
- Display mentions as styled pills in the input

### Modify `client/src/components/chat/MessageItem.tsx`

- Parse `<@userId>` patterns in message content and render as styled mention pills
- Mention pill styling: `bg-th-brand/20 text-th-brand rounded px-1 cursor-pointer hover:underline`
- Clicking a mention pill opens the user's profile card

### WS event handling

On `MESSAGE_CREATE`:
- If the channel is not currently active, call `handleNewMessage` on the unread store
- If the message mentions the current user, increment mention count

## Edge Cases

- User opens a channel: immediately mark as read
- User receives a message in the current channel while scrolled up: don't auto-mark as read until they scroll down
- Mention in a channel the user can't read: don't increment (permission check in service)
- `@everyone` by a user without MENTION_EVERYONE: treat as plain text, don't increment
- Deleted messages with mentions: don't decrement (mention count is approximate — exact count would require re-scanning)
- Server join: initialize read states for all accessible channels (set lastReadMessageId to latest message)

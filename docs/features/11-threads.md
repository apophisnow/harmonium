# 11 — Threads

## Summary

Users can create threads from any message to start a focused side conversation. Threads appear as a panel alongside the main channel. Requires Feature 01 (Message Replies) as foundation.

## Database Changes

### Modify `server/src/db/schema/channels.ts`

Add thread-related fields:

```typescript
parentChannelId: bigint('parent_channel_id', { mode: 'bigint' }).references(() => channels.id, { onDelete: 'cascade' }),
originMessageId: bigint('origin_message_id', { mode: 'bigint' }).references(() => messages.id, { onDelete: 'set null' }),
isThread: boolean('is_thread').notNull().default(false),
threadArchived: boolean('thread_archived').notNull().default(false),
threadArchivedAt: timestamp('thread_archived_at', { withTimezone: true }),
lastMessageAt: timestamp('last_message_at', { withTimezone: true }),  // for sorting active threads
messageCount: integer('message_count').notNull().default(0),
```

Threads ARE channels — they reuse the existing channel infrastructure. A thread is a channel where `isThread = true` and `parentChannelId` points to the text channel it was created in.

### Create `server/src/db/schema/thread-members.ts`

```typescript
import { pgTable, bigint, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { channels } from './channels.js';
import { users } from './users.js';

export const threadMembers = pgTable('thread_members', {
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.channelId, table.userId] }),
]);
```

Thread membership determines who gets notifications. Users are auto-added when they:
- Create the thread
- Send a message in the thread
- Are mentioned in the thread
- Manually join the thread

## Shared Types

### Modify `packages/shared/src/types/channel.ts`

Add to `Channel`:

```typescript
isThread: boolean;
parentChannelId: string | null;
originMessageId: string | null;
threadArchived: boolean;
lastMessageAt: string | null;
messageCount: number;
```

### Create `packages/shared/src/types/thread.ts`

```typescript
import type { Channel } from './channel.js';
import type { PublicUser } from './user.js';

export interface Thread extends Channel {
  isThread: true;
  parentChannelId: string;
  originMessageId: string | null;
  recentParticipants: PublicUser[];  // last 3-5 participants for UI display
}

export interface ThreadListItem {
  thread: Thread;
  hasUnread: boolean;
  mentionCount: number;
}
```

### Modify `packages/shared/src/ws-events.ts`

Add events:

```typescript
export interface ThreadCreateEvent {
  op: 'THREAD_CREATE';
  d: { thread: Thread; parentChannelId: string };
}

export interface ThreadUpdateEvent {
  op: 'THREAD_UPDATE';
  d: { thread: Thread };
}

export interface ThreadDeleteEvent {
  op: 'THREAD_DELETE';
  d: { threadId: string; parentChannelId: string };
}
```

## API Changes

### Create `server/src/modules/threads/`

**`threads.schemas.ts`:**

```typescript
export const createThreadSchema = z.object({
  name: safeText(z.string().min(1).max(100)),
  messageId: snowflakeId,  // the message to create a thread from
});
```

**`threads.service.ts`:**

- `createThread(parentChannelId, messageId, name, userId)`:
  1. Verify message exists in the parent channel
  2. Verify message doesn't already have a thread
  3. Create a new channel with `isThread = true`, `parentChannelId`, `originMessageId`
  4. Add the creator as a thread member
  5. Broadcast `THREAD_CREATE`
  6. Return the thread

- `getThreads(parentChannelId, options)`:
  1. Fetch threads where `parentChannelId` matches
  2. Options: `archived` (boolean), `limit`, `before`
  3. Include recent participants and message count
  4. Sort by `lastMessageAt DESC`

- `archiveThread(threadId, userId)`:
  1. Requires MANAGE_CHANNELS or being the thread creator
  2. Set `threadArchived = true`, `threadArchivedAt = now`
  3. Broadcast `THREAD_UPDATE`

- `unarchiveThread(threadId, userId)`:
  1. Reverse of archive

- `joinThread(threadId, userId)`:
  1. Insert into `thread_members`

- `leaveThread(threadId, userId)`:
  1. Delete from `thread_members`

### Modify `server/src/modules/messages/messages.service.ts`

In `createMessage`, when a message is sent to a thread channel:
1. Auto-add the sender as a thread member (if not already)
2. Update `lastMessageAt` on the thread channel
3. Increment `messageCount`

**`threads.routes.ts`:**

```
POST   /api/channels/:channelId/threads            — create thread from message
GET    /api/channels/:channelId/threads             — list threads in channel
GET    /api/channels/:channelId/threads/active      — list active (non-archived) threads
PATCH  /api/threads/:threadId                       — update thread (name, archive/unarchive)
DELETE /api/threads/:threadId                       — delete thread (requires MANAGE_CHANNELS)
POST   /api/threads/:threadId/members/@me           — join thread
DELETE /api/threads/:threadId/members/@me           — leave thread
```

Messages in threads use the existing message endpoints — a thread IS a channel.

## Frontend Changes

### Create `client/src/components/thread/ThreadPanel.tsx`

A right-side panel (replaces or overlays the member sidebar) showing the thread conversation:
- Header: thread name, parent channel name, close button, archive button
- Reuses `MessageList` and `MessageInput` components with the thread's channelId
- Shows the origin message at the top (the message the thread was created from)

### Create `client/src/components/thread/ThreadList.tsx`

Shows all active threads in the current channel (accessible from channel header):
- List of threads with: name, message count, last activity, recent participant avatars
- Click to open the thread panel

### Modify `client/src/components/chat/MessageItem.tsx`

- If a message has a thread, show a "Thread" indicator below it:
  - Thread name, reply count, recent participant avatars
  - "X replies, last reply Y minutes ago"
  - Clicking opens the thread panel

- Add "Create Thread" to the message context menu

### Modify `client/src/components/channel/ChannelHeader.tsx`

Add a "Threads" icon button that opens the ThreadList.

### Store changes

Add to `client/src/stores/channel.store.ts` or create `thread.store.ts`:

```typescript
activeThread: Thread | null;
threads: Map<string, Thread[]>;  // key: parentChannelId

openThread: (thread: Thread) => void;
closeThread: () => void;
fetchThreads: (parentChannelId: string) => Promise<void>;
createThread: (parentChannelId: string, messageId: string, name: string) => Promise<Thread>;
```

### Layout

When a thread is open, the main layout becomes three-column:
```
[Server] [Channel + Chat] [Thread Panel]
```

The member sidebar is hidden when the thread panel is open. On mobile, the thread panel is full-screen.

## Edge Cases

- Thread from a deleted message: thread still exists, origin message shows "[deleted]"
- Auto-archive: optionally auto-archive threads with no messages for 24h/3d/7d (configurable per server)
- Thread permissions: inherit from parent channel
- Nested threads: NOT supported — cannot create a thread from a message inside a thread
- Thread name: defaults to first ~30 chars of the origin message content if not provided
- Message in a thread that mentions a user: add them to thread members automatically
- Max threads per channel: no hard limit, but paginate the thread list

# 02 — Message Reactions

## Summary

Allow users to add emoji reactions to messages. Each reaction shows the emoji and a count. Users can click to toggle their own reaction.

## Database Changes

### Create `server/src/db/schema/reactions.ts`

```typescript
import { pgTable, bigint, varchar, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { messages } from './messages.js';
import { users } from './users.js';

export const reactions = pgTable('reactions', {
  messageId: bigint('message_id', { mode: 'bigint' }).notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 32 }).notNull(), // unicode emoji or custom emoji ID
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.messageId, table.userId, table.emoji] }),
  index('reactions_message_id_idx').on(table.messageId),
]);
```

- Composite primary key prevents duplicate reactions from the same user with the same emoji.
- Cascade delete when message is deleted.

### Export from `server/src/db/schema/index.ts`

Add `export * from './reactions.js';`

## Shared Types

### Create `packages/shared/src/types/reaction.ts`

```typescript
export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];  // IDs of users who reacted (for "you reacted" state)
}
```

### Modify `packages/shared/src/types/message.ts`

Add to `Message`:

```typescript
reactions?: Reaction[];
```

### Modify `packages/shared/src/ws-events.ts`

Add new S2C events:

```typescript
export interface ReactionAddEvent {
  op: 'REACTION_ADD';
  d: {
    channelId: string;
    messageId: string;
    userId: string;
    emoji: string;
  };
}

export interface ReactionRemoveEvent {
  op: 'REACTION_REMOVE';
  d: {
    channelId: string;
    messageId: string;
    userId: string;
    emoji: string;
  };
}
```

Add both to the `ServerEvent` union type.

## API Changes

### Create `server/src/modules/reactions/`

**`reactions.schemas.ts`:**

```typescript
export const reactionParamsSchema = z.object({
  channelId: snowflakeId,
  messageId: snowflakeId,
  emoji: z.string().min(1).max(32),
});
```

**`reactions.service.ts`:**

- `addReaction(messageId, userId, emoji)` — INSERT with ON CONFLICT DO NOTHING
- `removeReaction(messageId, userId, emoji)` — DELETE
- `getReactionsForMessages(messageIds)` — batch fetch reactions grouped by messageId and emoji, with counts and userIds

**`reactions.routes.ts`:**

```
PUT    /api/channels/:channelId/messages/:messageId/reactions/:emoji    — add reaction
DELETE /api/channels/:channelId/messages/:messageId/reactions/:emoji    — remove reaction
```

Both require `READ_MESSAGES` permission on the channel.

### Modify `server/src/modules/messages/messages.service.ts`

In `getMessages` and `createMessage`, batch-fetch reactions using `getReactionsForMessages()` and include them in the response.

## WebSocket Changes

### Create `server/src/ws/handlers/reaction.handler.ts`

```typescript
export function broadcastReactionAdd(pubsub, serverId, channelId, messageId, userId, emoji) {
  pubsub.publishToServer(serverId, {
    op: 'REACTION_ADD',
    d: { channelId, messageId, userId, emoji },
  });
}

export function broadcastReactionRemove(pubsub, serverId, channelId, messageId, userId, emoji) {
  pubsub.publishToServer(serverId, {
    op: 'REACTION_REMOVE',
    d: { channelId, messageId, userId, emoji },
  });
}
```

## Frontend Changes

### Create `client/src/api/reactions.ts`

```typescript
export async function addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  await apiClient.put(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
}

export async function removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  await apiClient.delete(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
}
```

### Modify `client/src/stores/message.store.ts`

Add actions:

```typescript
addReaction: (channelId, messageId, userId, emoji) => void;
removeReaction: (channelId, messageId, userId, emoji) => void;
```

These update the reactions array on the matching message in the store.

### Handle WS events in the gateway listener

On `REACTION_ADD` / `REACTION_REMOVE`, call the corresponding store action.

### Modify `client/src/components/chat/MessageItem.tsx`

- Below message content, render a row of reaction pills:
  - Each pill: `emoji + count` (e.g., "👍 3")
  - If the current user reacted, highlight the pill (`bg-th-brand/20 border-th-brand`)
  - Clicking a pill toggles the reaction (add/remove)
- Add a "Add Reaction" button (smiley face icon) to the hover action buttons
- Clicking "Add Reaction" opens an emoji picker popover

### Create `client/src/components/chat/EmojiPicker.tsx`

A simple grid of common unicode emojis organized by category. No need for a full picker library initially — a curated set of ~100 popular emojis in a popover is sufficient. Categories: Smileys, Hands, Hearts, Objects, Symbols.

### Styling

Reaction pill:
```
inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border border-th-border
hover:bg-th-bg-accent cursor-pointer transition-colors
```

Active (user reacted):
```
bg-th-brand/20 border-th-brand
```

## Edge Cases

- Emoji encoding: use `encodeURIComponent` in the URL path for emojis
- Maximum reactions per message: limit to 20 unique emojis per message (check in service)
- User spamming reactions: rate limit the PUT endpoint
- Deleted messages: cascade delete handles cleanup
- Reactions on messages in channels user can't read: check READ_MESSAGES permission

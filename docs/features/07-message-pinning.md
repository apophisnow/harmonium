# 07 — Message Pinning

## Summary

Allow users with appropriate permissions to pin messages in a channel. Pinned messages are accessible via a "Pinned Messages" panel.

## Database Changes

### Modify `server/src/db/schema/messages.ts`

Add to the `messages` table:

```typescript
isPinned: boolean('is_pinned').notNull().default(false),
pinnedAt: timestamp('pinned_at', { withTimezone: true }),
pinnedBy: bigint('pinned_by', { mode: 'bigint' }).references(() => users.id),
```

No new table needed — pinning is a message property.

### Migration

Add `is_pinned`, `pinned_at`, `pinned_by` columns.

## Shared Types

### Modify `packages/shared/src/types/message.ts`

Add to `Message`:

```typescript
isPinned: boolean;
pinnedAt: string | null;
pinnedBy: string | null;
```

### Modify `packages/shared/src/ws-events.ts`

Add S2C events:

```typescript
export interface MessagePinEvent {
  op: 'MESSAGE_PIN';
  d: { channelId: string; message: Message };
}

export interface MessageUnpinEvent {
  op: 'MESSAGE_UNPIN';
  d: { channelId: string; messageId: string };
}
```

## Permissions

### Modify `packages/shared/src/permissions.ts`

Add new permission flag:

```typescript
PIN_MESSAGES: 1n << 15n,
```

Add to default permissions for the @everyone role.

## API Changes

### Modify `server/src/modules/messages/`

**New endpoints in `messages.routes.ts`:**

```
PUT    /api/channels/:channelId/pins/:messageId    — pin a message (requires PIN_MESSAGES or MANAGE_MESSAGES)
DELETE /api/channels/:channelId/pins/:messageId    — unpin a message
GET    /api/channels/:channelId/pins               — get pinned messages
```

**New service functions in `messages.service.ts`:**

- `pinMessage(channelId, messageId, userId)`:
  1. Verify message exists and is in this channel
  2. Check channel pin count (max 50 per channel, like Discord)
  3. Update message: `isPinned = true, pinnedAt = now, pinnedBy = userId`
  4. Broadcast `MESSAGE_PIN`

- `unpinMessage(channelId, messageId)`:
  1. Verify message is pinned
  2. Update message: `isPinned = false, pinnedAt = null, pinnedBy = null`
  3. Broadcast `MESSAGE_UNPIN`

- `getPinnedMessages(channelId)`:
  1. Fetch messages where `isPinned = true` and `channelId` matches
  2. Order by `pinnedAt DESC`
  3. Include author and attachment data

## Frontend Changes

### Create `client/src/components/chat/PinnedMessages.tsx`

A slide-out panel (or modal) showing all pinned messages in the current channel:
- Triggered by a pin icon in the channel header
- Lists pinned messages with author, content, and timestamp
- Each message has an "Unpin" button (if user has permission)
- Clicking a pinned message scrolls to it in the main chat (if loaded)

### Modify `client/src/components/channel/ChannelHeader.tsx`

- Add a pin icon button that toggles the PinnedMessages panel
- Show pin count badge if > 0

### Modify `client/src/components/chat/MessageItem.tsx`

- Add "Pin Message" / "Unpin Message" to context menu
- Show a small pin icon on pinned messages in the message list

### Modify `client/src/stores/message.store.ts`

Add:

```typescript
pinnedMessages: Map<string, Message[]>;  // key: channelId
fetchPinnedMessages: (channelId: string) => Promise<void>;
pinMessage: (channelId: string, messageId: string) => void;
unpinMessage: (channelId: string, messageId: string) => void;
```

### API client

Add to `client/src/api/messages.ts`:

```typescript
export async function pinMessage(channelId, messageId): Promise<void>;
export async function unpinMessage(channelId, messageId): Promise<void>;
export async function getPinnedMessages(channelId): Promise<Message[]>;
```

## Edge Cases

- Max 50 pins per channel — return 400 with clear error message when exceeded
- Pinning a deleted message: reject with 400
- Pinning an already pinned message: no-op, return 200
- Deleting a pinned message: the soft-delete already handles this (isPinned stays true but content is null)
- Pin system messages: optionally send a system message "[User] pinned a message" in the channel

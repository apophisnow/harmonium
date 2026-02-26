# 01 — Message Replies

## Summary

Allow users to reply to a specific message. The reply shows a compact preview of the referenced message above the new message, similar to Discord's reply system.

## Database Changes

### Modify `server/src/db/schema/messages.ts`

Add a nullable `replyToId` column to the `messages` table:

```typescript
replyToId: bigint('reply_to_id', { mode: 'bigint' }).references(() => messages.id, { onDelete: 'set null' }),
```

- `onDelete: 'set null'` — if the original message is deleted, the reply still exists but the reference is cleared.

### Migration

Generate and run a Drizzle migration to add the column.

## Shared Types

### Modify `packages/shared/src/types/message.ts`

Add to the `Message` interface:

```typescript
replyToId: string | null;
replyTo?: Message | null;  // populated on fetch, the referenced message (without its own replyTo to avoid recursion)
```

## API Changes

### Modify `server/src/modules/messages/messages.schemas.ts`

Update `createMessageSchema` to accept an optional `replyToId`:

```typescript
replyToId: snowflakeId.optional(),
```

### Modify `server/src/modules/messages/messages.service.ts`

**`createMessage`:**
- Accept `replyToId` from input
- If provided, verify the referenced message exists and is in the same channel
- Store `replyToId` in the insert
- Include the referenced message in the response

**`getMessages` / `messageToResponse`:**
- When fetching messages, LEFT JOIN or batch-fetch the `replyTo` message data
- Include `replyTo` as a nested `Message` object (author + content + attachments, but NOT its own `replyTo` to prevent recursion)
- For deleted referenced messages: return `replyTo` with `isDeleted: true` and `content: null`

### No new endpoints needed — uses existing `POST /api/channels/:channelId/messages`

## WebSocket Changes

No new events needed. The existing `MESSAGE_CREATE` event payload already contains the full `Message` object — just ensure `replyTo` is included in the serialized message.

## Frontend Changes

### Modify `client/src/api/messages.ts`

Update `sendMessage` to accept an optional `replyToId` parameter and include it in the POST body.

### Modify `client/src/stores/message.store.ts`

Add reply state:

```typescript
replyingTo: Message | null;
setReplyingTo: (message: Message | null) => void;
```

### Modify `client/src/components/chat/MessageItem.tsx`

- If `message.replyTo` exists, render a compact reply preview bar above the message:
  - Show the referenced author's avatar (small, 16px) and username
  - Show a truncated preview of the referenced content (first ~80 chars)
  - If `replyTo.isDeleted`, show italic "Original message was deleted"
  - Clicking the reply preview scrolls to the original message (if in view)
- Add "Reply" to the message context menu and hover action buttons

### Modify `client/src/components/chat/MessageInput.tsx`

- When `replyingTo` is set, show a reply preview bar above the input:
  - "Replying to **username**" with an X button to cancel
  - Send the `replyToId` with the message
  - Clear `replyingTo` after sending

### Styling

Reply preview bar:
```
bg-th-bg-secondary border-l-2 border-th-brand rounded px-3 py-1 text-sm text-th-text-muted
```

## Edge Cases

- Replying to a deleted message: show "Original message was deleted" in preview
- Replying to a message in a different channel: reject in service layer with 400
- Deep reply chains: only include one level of `replyTo` (no recursive nesting)
- Reply to a message with attachments: show "[attachment]" text in preview if no content

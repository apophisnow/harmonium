# Task 10: Message Module (REST + WebSocket Broadcast)

## Objective
Implement message CRUD with cursor-based pagination, integrate with WebSocket for real-time delivery of new messages, edits, and deletions. Handle typing indicators end-to-end.

## Dependencies
- Task 6 (WebSocket gateway) - for broadcasting MESSAGE_CREATE/UPDATE/DELETE
- Task 9 (channel module) - channels must exist, channel permission checks

## Pre-existing Files to Read
- `server/src/db/schema/messages.ts` - messages, attachments tables
- `server/src/db/schema/channels.ts` - channels table (need to look up serverId for a channel)
- `server/src/db/schema/users.ts` - users table (for author data)
- `server/src/utils/permissions.ts` - requireChannelPermission, computeChannelPermissions
- `server/src/utils/snowflake.ts` - generateId
- `server/src/utils/errors.ts` - Error classes
- `server/src/ws/pubsub.ts` - PubSubManager
- `server/src/ws/handlers/typing.handler.ts` - Already handles WS typing events
- `packages/shared/src/types/message.ts` - Message, Attachment types
- `packages/shared/src/ws-events.ts` - MESSAGE_CREATE, MESSAGE_UPDATE, MESSAGE_DELETE events
- `packages/shared/src/permissions.ts` - SEND_MESSAGES, READ_MESSAGES, MANAGE_MESSAGES

## Files to Create

### 1. `server/src/modules/messages/messages.schemas.ts`
Zod schemas:
- `createMessageSchema`: { content: string (1-4000 chars) }
  - Note: file attachments handled separately in the upload module
- `updateMessageSchema`: { content: string (1-4000 chars) }
- `messagesQuerySchema`: { before?: string (snowflake ID), after?: string, limit?: number (1-100, default 50) }

### 2. `server/src/modules/messages/messages.service.ts`
Functions:
- `createMessage(channelId: string, authorId: string, input)`:
  1. Look up channel to get serverId
  2. Generate snowflake ID
  3. Insert message
  4. Query back with author data (JOIN users for avatar, username, discriminator)
  5. Publish MESSAGE_CREATE event via pub/sub to the server
  6. Return message with author

- `getMessages(channelId: string, query: { before?, after?, limit })`:
  - Cursor-based pagination using snowflake IDs
  - If `before` provided: WHERE id < before ORDER BY id DESC LIMIT limit
  - If `after` provided: WHERE id > after ORDER BY id ASC LIMIT limit
  - Default (no cursor): ORDER BY id DESC LIMIT limit (newest first)
  - Always JOIN users to include author data
  - Exclude soft-deleted messages (isDeleted = true) OR include them with content nulled out (to show "message was deleted")
  - Return messages in chronological order (reverse the DESC results)

- `updateMessage(messageId: string, userId: string, input)`:
  - Verify author is the requesting user (only author can edit)
  - Update content, set editedAt = now
  - Publish MESSAGE_UPDATE event
  - Return updated message

- `deleteMessage(messageId: string, channelId: string, userId: string)`:
  - Check: author can delete own messages, MANAGE_MESSAGES permission can delete any
  - Soft delete: set isDeleted = true, content = null
  - Publish MESSAGE_DELETE event
  - Return success

### 3. `server/src/modules/messages/messages.routes.ts`
Plugin at prefix `/api/channels/:channelId/messages`. All require auth.

Routes:
- `POST /` - Send message (requires SEND_MESSAGES + READ_MESSAGES in channel)
- `GET /` - Get message history (requires READ_MESSAGES in channel)
  - Query params: ?before=<id>&limit=50
- `PATCH /:messageId` - Edit message (author only)
- `DELETE /:messageId` - Delete message (author or MANAGE_MESSAGES)

### 4. `server/src/ws/handlers/message.handler.ts`
This file handles the server-side broadcasting of message events. It should export functions that the message service calls:

```typescript
export function broadcastMessageCreate(pubsub: PubSubManager, serverId: string, message: Message): void {
  pubsub.publishToServer(serverId, {
    op: 'MESSAGE_CREATE',
    d: { message }
  });
}

export function broadcastMessageUpdate(pubsub: PubSubManager, serverId: string, message: Partial<Message> & { id: string; channelId: string }): void {
  pubsub.publishToServer(serverId, {
    op: 'MESSAGE_UPDATE',
    d: { message }
  });
}

export function broadcastMessageDelete(pubsub: PubSubManager, serverId: string, messageId: string, channelId: string): void {
  pubsub.publishToServer(serverId, {
    op: 'MESSAGE_DELETE',
    d: { id: messageId, channelId }
  });
}
```

### 5. Update `server/src/app.ts`
Register messages route module.

## Pagination Details
Messages use cursor-based pagination with snowflake IDs. This is crucial for performance:
- No OFFSET (would scan skipped rows)
- Snowflake IDs are sortable, so `WHERE id < cursor` efficiently uses the index
- Index: `(channel_id, id DESC)` supports the primary query pattern
- Client loads initial messages (no cursor), then loads older messages with `?before=<oldest_id>`

## Acceptance Criteria
- [ ] POST creates message with snowflake ID, returns with author data
- [ ] GET returns paginated messages with cursor-based pagination
- [ ] Pagination works correctly: before, after, and default (latest)
- [ ] Messages include author object (id, username, discriminator, avatarUrl)
- [ ] PATCH edits message content (author only), sets editedAt
- [ ] DELETE soft-deletes message (author or MANAGE_MESSAGES)
- [ ] MESSAGE_CREATE broadcast to server subscribers via WebSocket/pub/sub
- [ ] MESSAGE_UPDATE broadcast on edit
- [ ] MESSAGE_DELETE broadcast on delete
- [ ] Permission checks: SEND_MESSAGES, READ_MESSAGES, MANAGE_MESSAGES
- [ ] Limit enforced (max 100 messages per request)
- [ ] TypeScript compilation passes

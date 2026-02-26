# 15 — Webhooks

## Summary

Server admins can create webhooks that allow external services to post messages to a channel. Webhook messages appear with a custom name and avatar. Useful for integrations like GitHub notifications, CI/CD alerts, and custom bots.

## Database Changes

### Create `server/src/db/schema/webhooks.ts`

```typescript
import { pgTable, bigint, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { channels } from './channels.js';
import { users } from './users.js';

export const webhooks = pgTable('webhooks', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  channelId: bigint('channel_id', { mode: 'bigint' }).notNull().references(() => channels.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 80 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 512 }),
  token: varchar('token', { length: 68 }).notNull().unique(),  // secret token for posting
  createdBy: bigint('created_by', { mode: 'bigint' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('webhooks_server_id_idx').on(table.serverId),
  index('webhooks_channel_id_idx').on(table.channelId),
  index('webhooks_token_idx').on(table.token),
]);
```

### Modify `server/src/db/schema/messages.ts`

Add webhook support to messages:

```typescript
webhookId: bigint('webhook_id', { mode: 'bigint' }).references(() => webhooks.id, { onDelete: 'set null' }),
webhookName: varchar('webhook_name', { length: 80 }),      // snapshot of webhook name at send time
webhookAvatarUrl: varchar('webhook_avatar_url', { length: 512 }),  // snapshot of avatar
```

When a webhook sends a message, `authorId` is still required — use a system/bot user or the webhook creator. The `webhookName` and `webhookAvatarUrl` override the displayed author.

## Shared Types

### Create `packages/shared/src/types/webhook.ts`

```typescript
export interface Webhook {
  id: string;
  serverId: string;
  channelId: string;
  name: string;
  avatarUrl: string | null;
  token: string;          // only shown to the creator/admin
  createdBy: string;
  createdAt: string;
}

// Public version without token
export type WebhookInfo = Omit<Webhook, 'token'>;
```

### Modify `packages/shared/src/types/message.ts`

Add to `Message`:

```typescript
webhookId: string | null;
webhookName: string | null;
webhookAvatarUrl: string | null;
```

## API Changes

### Create `server/src/modules/webhooks/`

**`webhooks.schemas.ts`:**

```typescript
export const createWebhookSchema = z.object({
  name: safeText(z.string().min(1).max(80)),
  channelId: snowflakeId,
});

export const updateWebhookSchema = z.object({
  name: safeText(z.string().min(1).max(80)).optional(),
  channelId: snowflakeId.optional(),
});

export const executeWebhookSchema = z.object({
  content: safeText(z.string().min(1).max(4000)).optional(),
  username: safeText(z.string().min(1).max(80)).optional(),  // override webhook name
  avatarUrl: z.string().url().optional(),                     // override avatar
});
```

**`webhooks.service.ts`:**

- `createWebhook(serverId, channelId, name, createdBy)`:
  1. Generate a snowflake ID
  2. Generate a secure random token (`crypto.randomBytes(32).toString('hex')` + webhook ID)
  3. Insert webhook record
  4. Return webhook with token

- `updateWebhook(webhookId, updates)`:
  1. Update name, channel, or avatar

- `deleteWebhook(webhookId)`:
  1. Delete webhook record

- `getWebhooks(serverId)`:
  1. Fetch all webhooks for the server (with tokens if requester has MANAGE_SERVER)

- `getWebhookByToken(token)`:
  1. Fetch webhook by token (for execution endpoint, no auth needed)

- `executeWebhook(token, content, username?, avatarUrl?)`:
  1. Validate token
  2. Create a message in the webhook's channel
  3. Set `webhookId`, `webhookName` (override or default), `webhookAvatarUrl`
  4. Broadcast via WebSocket as a normal `MESSAGE_CREATE`

**`webhooks.routes.ts`:**

Authenticated (require MANAGE_SERVER):
```
POST   /api/servers/:serverId/webhooks              — create webhook
GET    /api/servers/:serverId/webhooks               — list webhooks
PATCH  /api/webhooks/:webhookId                      — update webhook
DELETE /api/webhooks/:webhookId                      — delete webhook
```

Public (authenticated by token):
```
POST   /api/webhooks/:webhookId/:token               — execute webhook (send message)
```

The execute endpoint does NOT require JWT auth — it's authenticated by the webhook token. Rate limit: 30 requests per minute per webhook.

## Frontend Changes

### Create `client/src/api/webhooks.ts`

```typescript
export async function createWebhook(serverId, channelId, name): Promise<Webhook>;
export async function getWebhooks(serverId): Promise<Webhook[]>;
export async function updateWebhook(webhookId, data): Promise<Webhook>;
export async function deleteWebhook(webhookId): Promise<void>;
```

### Add "Webhooks" tab to server settings

**Create `client/src/components/server/WebhookSettings.tsx`:**

- List of webhooks with: name, channel, creator, creation date
- Each webhook shows:
  - "Copy Webhook URL" button (copies `{baseUrl}/api/webhooks/{id}/{token}`)
  - Edit button (name, channel)
  - Delete button with confirmation
- "Create Webhook" button:
  - Name input
  - Channel selector dropdown
  - Avatar upload (optional)

### Modify `client/src/components/chat/MessageItem.tsx`

For messages with `webhookId`:
- Display `webhookName` instead of the author username
- Display `webhookAvatarUrl` instead of the author avatar
- Show a small "BOT" badge next to the name
- Don't show "Edit" or "Reply" in context menu for webhook messages

## Webhook URL Format

```
POST https://your-instance.com/api/webhooks/{webhookId}/{token}
Content-Type: application/json

{
  "content": "Hello from a webhook!",
  "username": "GitHub",          // optional override
  "avatarUrl": "https://..."     // optional override
}
```

## Edge Cases

- Token regeneration: add an endpoint to regenerate the token (invalidates the old one)
- Webhook avatar upload: use the same image processing pipeline as user avatars
- Channel deletion: cascade deletes webhooks in that channel
- Webhook message editing: webhooks cannot edit messages after sending
- Webhook message file attachments: support multipart/form-data for file uploads (optional, can defer)
- Rate limiting: per-webhook rate limit to prevent abuse
- Max webhooks per server: 10 (configurable)
- Invalid token: return 401 with "Invalid webhook token"

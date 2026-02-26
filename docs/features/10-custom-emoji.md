# 10 — Custom Emoji

## Summary

Server owners/admins can upload custom emojis. Custom emojis can be used in messages and reactions. Emojis are scoped to a server but visible to all members.

## Database Changes

### Create `server/src/db/schema/emojis.ts`

```typescript
import { pgTable, bigint, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { servers } from './servers.js';
import { users } from './users.js';

export const emojis = pgTable('emojis', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  serverId: bigint('server_id', { mode: 'bigint' }).notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  imageUrl: varchar('image_url', { length: 512 }).notNull(),
  animated: boolean('animated').notNull().default(false),
  uploadedBy: bigint('uploaded_by', { mode: 'bigint' }).notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('emojis_server_id_idx').on(table.serverId),
  index('emojis_server_id_name_idx').on(table.serverId, table.name),
]);
```

## Shared Types

### Create `packages/shared/src/types/emoji.ts`

```typescript
export interface CustomEmoji {
  id: string;
  serverId: string;
  name: string;
  imageUrl: string;
  animated: boolean;
  uploadedBy: string;
  createdAt: string;
}
```

### Modify `packages/shared/src/types/server.ts`

Add to `Server`:

```typescript
emojis?: CustomEmoji[];
```

### Format convention

Custom emojis in message content and reactions use the format: `<:name:id>` (or `<a:name:id>` for animated).

This distinguishes custom emojis from unicode emojis in both messages and the reactions system.

## API Changes

### Create `server/src/modules/emojis/`

**`emojis.schemas.ts`:**

```typescript
export const createEmojiSchema = z.object({
  name: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Emoji name can only contain letters, numbers, and underscores'),
});
```

**`emojis.service.ts`:**

- `createEmoji(serverId, name, imageBuffer, contentType, uploadedBy)`:
  1. Validate image: must be PNG, GIF, or WebP
  2. Max file size: 256KB
  3. Resize to 128x128 (or leave as-is if smaller)
  4. Detect if animated (GIF with multiple frames)
  5. Store image using the storage provider
  6. Insert emoji record
  7. Generate snowflake ID
  8. Return emoji

- `deleteEmoji(serverId, emojiId)`:
  1. Delete from storage
  2. Delete from DB

- `getServerEmojis(serverId)`:
  1. Fetch all emojis for the server

- `getEmoji(emojiId)`:
  1. Fetch single emoji (for rendering in other servers via messages)

**`emojis.routes.ts`:**

```
POST   /api/servers/:serverId/emojis              — upload emoji (requires MANAGE_SERVER, multipart)
DELETE /api/servers/:serverId/emojis/:emojiId      — delete emoji (requires MANAGE_SERVER)
GET    /api/servers/:serverId/emojis               — list server emojis
PATCH  /api/servers/:serverId/emojis/:emojiId      — rename emoji (requires MANAGE_SERVER)
```

### Modify message rendering

In `getMessages`, when serializing messages, custom emoji patterns `<:name:id>` are left as-is in the content string. The frontend parses and renders them.

### Modify reactions system (Feature 02)

The `emoji` field in the reactions table already supports strings up to 32 chars. For custom emojis, store the emoji as `name:id` format. When returning reactions, resolve the custom emoji data (imageUrl) for display.

## Frontend Changes

### Modify `client/src/components/chat/EmojiPicker.tsx`

Add a "Server" tab to the emoji picker that shows the current server's custom emojis:
- Grid of custom emoji images
- Hover shows `:name:`
- Click inserts `<:name:id>` into message content
- Search filters both unicode and custom emojis

### Create `client/src/components/chat/CustomEmoji.tsx`

Inline component that renders a custom emoji:
- Takes `emojiId` and `name` props
- Renders the emoji image at 22px (inline) or 48px (jumbo, when message is only emojis)
- Tooltip shows `:name:`
- Falls back to `:name:` text if image fails to load

### Modify `client/src/components/chat/MessageItem.tsx`

Parse `<:name:id>` and `<a:name:id>` patterns in message content and replace with `<CustomEmoji>` components.

### Create emoji management in server settings

Add an "Emoji" tab to server settings:
- Grid of current emojis with name, uploader, and delete button
- Upload form: drag-and-drop or file picker
- Name input with validation (alphanumeric + underscores)
- Show count: "X / 50 emoji slots used"

### API client

Create `client/src/api/emojis.ts`:

```typescript
export async function getServerEmojis(serverId: string): Promise<CustomEmoji[]>;
export async function uploadEmoji(serverId: string, name: string, file: File): Promise<CustomEmoji>;
export async function deleteEmoji(serverId: string, emojiId: string): Promise<void>;
export async function renameEmoji(serverId: string, emojiId: string, name: string): Promise<CustomEmoji>;
```

### Store

Add emojis to the server store or create a dedicated emoji store:

```typescript
serverEmojis: Map<string, CustomEmoji[]>;  // key: serverId
fetchServerEmojis: (serverId: string) => Promise<void>;
```

## Edge Cases

- Max emojis per server: 50 (configurable)
- Duplicate name in same server: reject with 400
- Emoji used in reactions but later deleted: show `:deleted_emoji:` text fallback
- Custom emoji from another server in a message: render if the emoji data can be fetched by ID
- Animated emojis: only play animation on hover (or always, make it a user setting)
- Name validation: alphanumeric and underscores only, 2-32 chars
- Image validation: reject non-image files, enforce size limit

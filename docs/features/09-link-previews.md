# 09 — Link Previews / Embeds

## Summary

When a message contains a URL, the server fetches metadata (Open Graph / Twitter Card / oEmbed) and generates a rich preview embed displayed below the message.

## Database Changes

### Create `server/src/db/schema/embeds.ts`

```typescript
import { pgTable, bigint, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { messages } from './messages.js';

export const embeds = pgTable('embeds', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
  messageId: bigint('message_id', { mode: 'bigint' }).notNull().references(() => messages.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('link'),  // 'link', 'image', 'video', 'rich'
  title: varchar('title', { length: 256 }),
  description: text('description'),
  siteName: varchar('site_name', { length: 100 }),
  imageUrl: varchar('image_url', { length: 2048 }),
  imageWidth: integer('image_width'),
  imageHeight: integer('image_height'),
  color: varchar('color', { length: 7 }),  // hex color from theme-color meta tag
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('embeds_message_id_idx').on(table.messageId),
]);
```

### Export from schema index

## Shared Types

### Create `packages/shared/src/types/embed.ts`

```typescript
export interface Embed {
  id: string;
  url: string;
  type: 'link' | 'image' | 'video' | 'rich';
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  color: string | null;
}
```

### Modify `packages/shared/src/types/message.ts`

Add to `Message`:

```typescript
embeds?: Embed[];
```

### Modify `packages/shared/src/ws-events.ts`

Add S2C event:

```typescript
export interface MessageEmbedEvent {
  op: 'MESSAGE_EMBED_UPDATE';
  d: { channelId: string; messageId: string; embeds: Embed[] };
}
```

## API / Server Changes

### Create `server/src/modules/embeds/`

**`embeds.service.ts`:**

Core function: `fetchAndStoreEmbeds(messageId, content, serverId)`:

1. Extract URLs from message content using regex: `https?://[^\s<>]+`
2. Limit to first 5 URLs per message
3. For each URL, fetch metadata in the background (don't block message send):
   - HTTP GET with timeout (5s), max response size (1MB), follow redirects (max 3)
   - Set a `User-Agent` identifying the bot
   - Parse HTML for Open Graph (`og:title`, `og:description`, `og:image`, `og:site_name`) and Twitter Card meta tags
   - Extract `theme-color` meta tag for accent color
4. Store embeds in the database
5. Broadcast `MESSAGE_EMBED_UPDATE` to the channel

**Important: this runs asynchronously after message creation.** The message is sent immediately, and embeds arrive as a follow-up event.

**URL fetching safety:**
- Blocklist private/internal IPs (127.0.0.1, 10.x.x.x, 192.168.x.x, etc.) — SSRF prevention
- Timeout: 5 seconds per URL
- Max response body: 1MB (only read enough to parse `<head>`)
- Only follow HTTP redirects to public IPs
- Cache fetched metadata for 1 hour (Redis or in-memory) to avoid refetching the same URL

**`embeds.routes.ts`:**

No public endpoints. Embed generation is triggered internally by message creation.

### Modify `server/src/modules/messages/messages.service.ts`

In `createMessage`, after broadcasting the message:

```typescript
// Fire-and-forget embed fetching
if (message.content) {
  fetchAndStoreEmbeds(message.id, message.content, serverId).catch(err => {
    logger.warn('Failed to fetch embeds', { messageId: message.id, error: err });
  });
}
```

In `getMessages`, include embeds in the response (LEFT JOIN or batch fetch).

## Frontend Changes

### Modify `client/src/stores/message.store.ts`

Handle `MESSAGE_EMBED_UPDATE` WS event:
- Find the message by ID in the store
- Update its `embeds` array

### Create `client/src/components/chat/MessageEmbed.tsx`

Renders a rich embed card below message content:

```
┌─ color bar (2px left border, from embed.color or default)
│  Site Name (small, muted text)
│  Title (bold, link to URL)
│  Description (muted, max 3 lines, truncated)
│  ┌──────────────┐
│  │   Image      │ (if imageUrl, max height 300px)
│  └──────────────┘
└─
```

Styling:
```
bg-th-bg-secondary border-l-4 rounded px-3 py-2 max-w-[400px]
```

If embed type is `image` and no title/description, show just the image preview.

### Modify `client/src/components/chat/MessageItem.tsx`

After message content, render embeds:

```tsx
{message.embeds?.map(embed => (
  <MessageEmbed key={embed.id} embed={embed} />
))}
```

## Dependencies

Add to `server/package.json`:

```json
"cheerio": "^1.0.0"   // HTML parsing for meta tag extraction
```

Use `cheerio` to parse the HTML `<head>` section and extract Open Graph / meta tags. Alternatively, use a lightweight custom parser with regex for just the meta tags to avoid the dependency.

## Edge Cases

- URL that times out: skip silently, no embed
- URL that returns non-HTML (PDF, image): for direct image URLs, create an `image` type embed
- URL behind authentication: will fail to fetch, skip gracefully
- Message edit: re-fetch embeds for the new content, delete old embeds
- Message with no URLs: skip embed processing entirely
- SSRF prevention: critical — validate all URLs against a blocklist of private IP ranges before fetching
- Rate limiting embed fetches: use a queue/semaphore to limit concurrent fetches (e.g., max 10 in-flight)
- Caching: cache URL metadata in Redis with 1-hour TTL to avoid refetching popular URLs

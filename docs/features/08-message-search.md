# 08 — Message Search

## Summary

Full-text search across messages within a server or channel. Supports filtering by author, channel, date range, and content keywords.

## Database Changes

### Add full-text search index

Add a GIN index on the `messages` table for PostgreSQL full-text search:

```sql
-- Migration SQL
ALTER TABLE messages ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX messages_search_idx ON messages USING GIN (search_vector);
```

In Drizzle schema, add:

```typescript
searchVector: varchar('search_vector'),  // managed by Postgres, not by app code
```

The `GENERATED ALWAYS` column auto-updates when `content` changes. No application-level indexing needed.

### Migration

- Add the generated `search_vector` column
- Create the GIN index

## Shared Types

### Create `packages/shared/src/types/search.ts`

```typescript
import type { Message } from './message.js';

export interface SearchResult {
  message: Message;
  channelName: string;
  serverName: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}

export interface SearchFilters {
  query: string;
  serverId?: string;
  channelId?: string;
  authorId?: string;
  before?: string;   // ISO date
  after?: string;    // ISO date
  limit?: number;
  offset?: number;
}
```

## API Changes

### Create `server/src/modules/search/`

**`search.schemas.ts`:**

```typescript
export const searchQuerySchema = z.object({
  query: z.string().min(1).max(200),
  serverId: snowflakeId.optional(),
  channelId: snowflakeId.optional(),
  authorId: snowflakeId.optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
```

**`search.service.ts`:**

```typescript
export async function searchMessages(userId: string, filters: SearchFilters): Promise<SearchResponse> {
  // 1. Build query with ts_query
  const tsQuery = filters.query
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `${term}:*`)  // prefix matching
    .join(' & ');

  // 2. Base query: join messages + channels + servers
  // 3. Apply filters: serverId, channelId, authorId, date range
  // 4. Permission check: only return messages from channels the user can read
  //    - For server channels: check server membership and READ_MESSAGES permission
  //    - For DM channels: check DM membership
  // 5. WHERE search_vector @@ to_tsquery('english', tsQuery)
  // 6. ORDER BY ts_rank(search_vector, tsQuery) DESC, messages.id DESC
  // 7. LIMIT + OFFSET
  // 8. COUNT(*) OVER() for totalCount

  return { results, totalCount };
}
```

**`search.routes.ts`:**

```
GET /api/search/messages?query=...&serverId=...&channelId=...    — search messages
```

Rate limit: 5 requests per 5 seconds per user.

## Frontend Changes

### Create `client/src/api/search.ts`

```typescript
export async function searchMessages(filters: SearchFilters): Promise<SearchResponse>;
```

### Create `client/src/stores/search.store.ts`

```typescript
interface SearchState {
  results: SearchResult[];
  totalCount: number;
  isSearching: boolean;
  query: string;
  filters: Partial<SearchFilters>;

  search: (filters: SearchFilters) => Promise<void>;
  clearSearch: () => void;
  loadMore: () => Promise<void>;
}
```

### Create `client/src/components/search/SearchModal.tsx`

A modal or slide-out panel for search:
- Search input with debounced search (300ms)
- Filter dropdowns: Channel, User, Date range
- Results list showing:
  - Message content with search terms highlighted
  - Author, channel name, timestamp
  - Clicking a result navigates to that message in the channel
- "Load more" pagination
- Empty state: "No results found"
- Loading state: skeleton items

### Modify `client/src/components/channel/ChannelHeader.tsx`

Add a search icon button that opens the SearchModal.

### Add keyboard shortcut

`Ctrl/Cmd + F` while in the app opens the search modal (only when not typing in an input field).

## Edge Cases

- Empty query: return empty results
- Special characters in query: escape for ts_query safety
- Search across servers: only return results from servers the user is a member of
- Deleted messages: exclude from search (WHERE isDeleted = false)
- Very common words (stop words): Postgres handles this with full-text search
- Performance: the GIN index handles large datasets; add a timeout safeguard (5s query timeout)
- No results: show helpful message suggesting different search terms

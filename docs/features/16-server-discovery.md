# 16 — Server Discovery

## Summary

A public server directory where users can browse and join servers that have opted in to being discoverable. Includes categories, search, and member counts.

## Database Changes

### Modify `server/src/db/schema/servers.ts`

Add discovery fields:

```typescript
isDiscoverable: boolean('is_discoverable').notNull().default(false),
description: varchar('description', { length: 1000 }),
category: varchar('category', { length: 50 }),      // 'gaming', 'music', 'education', 'technology', 'art', 'community', 'other'
vanityUrl: varchar('vanity_url', { length: 32 }).unique(),  // custom invite slug
memberCount: integer('member_count').notNull().default(0),  // denormalized for sorting
bannerUrl: varchar('banner_url', { length: 512 }),
primaryLanguage: varchar('primary_language', { length: 10 }).default('en'),
```

### Add index for discovery queries

```typescript
index('servers_discoverable_idx').on(table.isDiscoverable, table.memberCount),
```

### Migration

Add new columns and index. Backfill `memberCount` from `server_members` count.

### Keep memberCount in sync

Add triggers or application-level updates:
- On member join: increment `memberCount`
- On member leave/kick/ban: decrement `memberCount`

Modify `servers.service.ts` join/leave functions to update the count.

## Shared Types

### Modify `packages/shared/src/types/server.ts`

Add to `Server`:

```typescript
isDiscoverable: boolean;
description: string | null;
category: string | null;
vanityUrl: string | null;
memberCount: number;
bannerUrl: string | null;
primaryLanguage: string | null;
```

### Create `packages/shared/src/types/discovery.ts`

```typescript
export interface DiscoveryServer {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  category: string | null;
  memberCount: number;
  primaryLanguage: string | null;
}

export interface DiscoveryResponse {
  servers: DiscoveryServer[];
  totalCount: number;
}

export const SERVER_CATEGORIES = [
  'gaming',
  'music',
  'education',
  'technology',
  'art',
  'science',
  'entertainment',
  'community',
  'other',
] as const;

export type ServerCategory = typeof SERVER_CATEGORIES[number];
```

## API Changes

### Create `server/src/modules/discovery/`

**`discovery.schemas.ts`:**

```typescript
export const discoveryQuerySchema = z.object({
  query: z.string().max(100).optional(),
  category: z.enum(SERVER_CATEGORIES).optional(),
  sort: z.enum(['member_count', 'newest', 'alphabetical']).default('member_count'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
```

**`discovery.service.ts`:**

- `getDiscoverableServers(filters)`:
  1. Query servers where `isDiscoverable = true`
  2. Apply search filter (ILIKE on name and description)
  3. Apply category filter
  4. Apply sort order
  5. Return paginated results with total count

- `getDiscoveryServer(serverId)`:
  1. Get a single discoverable server's full info

**`discovery.routes.ts`:**

```
GET /api/discovery/servers                     — browse/search discoverable servers (authenticated)
GET /api/discovery/servers/:serverId           — get discovery info for a server (authenticated)
```

### Modify `server/src/modules/servers/`

**`servers.routes.ts` — add discovery settings:**

```
PATCH /api/servers/:serverId/discovery          — update discovery settings (owner only)
PUT   /api/servers/:serverId/banner             — upload banner image (owner only)
```

**`servers.schemas.ts`:**

```typescript
export const updateDiscoverySchema = z.object({
  isDiscoverable: z.boolean().optional(),
  description: safeText(z.string().max(1000)).optional(),
  category: z.enum(SERVER_CATEGORIES).optional(),
  vanityUrl: z.string().min(3).max(32).regex(/^[a-z0-9-]+$/, 'Vanity URL can only contain lowercase letters, numbers, and hyphens').optional(),
  primaryLanguage: z.string().max(10).optional(),
});
```

### Vanity URL support

If a server has a vanity URL, it can be joined via `/invite/{vanityUrl}`:
- Modify the invite acceptance flow to check for vanity URLs if the code doesn't match a standard invite

## Frontend Changes

### Create `client/src/api/discovery.ts`

```typescript
export async function getDiscoverableServers(filters?: DiscoveryFilters): Promise<DiscoveryResponse>;
export async function getDiscoveryServer(serverId: string): Promise<DiscoveryServer>;
export async function updateDiscoverySettings(serverId: string, settings: DiscoverySettings): Promise<void>;
export async function uploadServerBanner(serverId: string, file: File): Promise<void>;
```

### Create `client/src/pages/DiscoveryPage.tsx`

A dedicated page/view for browsing public servers:

**Header:**
- "Discover Servers" title
- Search input with debounce
- Category filter chips

**Server grid:**
- Card layout (3 columns on desktop, 2 on tablet, 1 on mobile)
- Each card shows:
  - Server banner image (or gradient placeholder) at top
  - Server icon, name, member count
  - Description (2 lines, truncated)
  - Category badge
  - "Join" button (or "Joined" if already a member)

**Sorting:**
- Dropdown: "Most Members", "Newest", "Alphabetical"

**Pagination:**
- "Load More" button or infinite scroll

### Server card styling

```
bg-th-bg-secondary rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer
```

Banner area: `h-32 bg-gradient-to-r from-th-brand to-th-brand/60` (if no banner)

### Navigation

Add a compass/explore icon to the server sidebar (below the server list, above the "add server" button) that navigates to the discovery page.

### Discovery settings in server settings

Add a "Discovery" tab to server settings (visible to owner only):

- Toggle: "Make this server discoverable"
- When enabled, show:
  - Description textarea
  - Category dropdown
  - Primary language dropdown
  - Vanity URL input with availability check
  - Banner image upload (recommended 960x540)

### Modify `client/src/components/layout/ServerSidebar.tsx`

Add an explore/compass icon button that navigates to the discovery view.

## Edge Cases

- Empty search results: show "No servers found" with suggestions
- Server with 0 members being discoverable: should have at least 1 (the owner)
- Vanity URL conflicts: return 409 with "This URL is already taken"
- Vanity URL changes: old URL stops working immediately
- Discoverable server deleted: automatically removed from discovery
- Rate limiting: limit discovery queries to prevent scraping
- Server description with markdown: strip markdown for discovery cards, show plain text
- NSFW servers: add an `isNsfw` flag and filter by default (optional, can defer)
- Banner image: process with Sharp, resize to 960x540, convert to WebP

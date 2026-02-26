# Harmonium Feature Roadmap

## Implementation Order & Rationale

Features are ordered so that each builds on the last. Simpler, self-contained features come first; larger features that depend on earlier work come later.

| #  | Feature              | Depends On     | Complexity | Files Touched |
|----|----------------------|----------------|------------|---------------|
| 01 | Message Replies      | —              | Low        | ~12           |
| 02 | Message Reactions    | —              | Medium     | ~14           |
| 03 | Unread Tracking      | —              | Medium     | ~16           |
| 04 | Member Bans          | —              | Low        | ~10           |
| 05 | Direct Messages      | —              | High       | ~25           |
| 06 | Friends System       | 05 (DMs)       | Medium     | ~18           |
| 07 | Message Pinning      | —              | Low        | ~10           |
| 08 | Message Search       | —              | Medium     | ~10           |
| 09 | Link Previews        | —              | Medium     | ~8            |
| 10 | Custom Emoji         | 02 (Reactions) | Medium     | ~16           |
| 11 | Threads              | 01 (Replies)   | High       | ~20           |
| 12 | Audit Log            | —              | Medium     | ~14           |
| 13 | Markdown Rendering   | —              | Low        | ~4            |
| 14 | Image Previews       | —              | Low        | ~4            |
| 15 | Webhooks             | —              | Medium     | ~12           |
| 16 | Server Discovery     | —              | Medium     | ~12           |

## Architecture Conventions

Every feature follows the same layered pattern:

```
packages/shared/    → Types, WS events, permission flags
server/src/db/      → Drizzle schema + migration
server/src/modules/ → Routes, schemas (Zod), service
server/src/ws/      → WS event handlers + broadcast helpers
client/src/api/     → Axios API client functions
client/src/stores/  → Zustand store (or additions to existing)
client/src/components/ → React UI components
```

### Key patterns to follow
- **IDs**: Snowflake bigints in DB, strings in API/types
- **Validation**: Zod schemas with `safeText()` and `snowflakeId`
- **Permissions**: Bitfield flags in `packages/shared/src/permissions.ts`
- **Real-time**: `pubsub.publishToServer(serverId, { op, d })` pattern
- **State**: Zustand stores with `Map<string, T>` and immutable updates
- **Styling**: Tailwind with `th-*` theme variables
- **Soft deletes**: Use `isDeleted` flag, never hard-delete user content

## How to Use These Documents

Each document (`01-*.md` through `16-*.md`) is a self-contained implementation plan. Hand one to Claude Code and say:

```
Implement the feature described in docs/features/XX-feature-name.md
```

Each document specifies:
1. Exact files to create or modify
2. Database schema changes
3. API endpoints with request/response shapes
4. WebSocket events
5. Frontend components and store changes
6. Edge cases and testing notes

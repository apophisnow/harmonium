# Follow-Up: Medium & Low Severity Issues

Issues deferred from the initial review pass. Tackle after critical/high items are resolved.

---

## Medium Severity

### #12 — Auth Store Hydrates Expired Tokens
- **File:** `client/src/stores/auth.store.ts` (lines 115-141)
- Hydrate should decode JWT and check `exp` claim. If expired, clear tokens instead of restoring them.

### #13 — MessageItem Missing React.memo
- **File:** `client/src/components/chat/MessageItem.tsx`
- Wrap export in `React.memo()` to prevent unnecessary re-renders in high-traffic channels.

### #14 — Embed URLs Not Protocol-Validated
- **File:** `client/src/components/chat/MessageEmbed.tsx` (lines 14, 37, 53)
- Validate that `href` values start with `http://` or `https://`. Reject `javascript:` and other protocols.

### #15 — Silent Fire-and-Forget Error Handling
- **Files:** `server/src/modules/messages/messages.service.ts` (line 341), multiple others
- Replace empty `.catch(() => {})` with `.catch(err => logger.warn('...', err))`.

### #16 — Permission Computation Makes 4+ Sequential DB Queries
- **File:** `server/src/utils/permissions.ts` (lines 17-82)
- Batch queries or cache with Redis. Consider a single JOIN query.

### #17 — Duplicate Permission Logic Across 3 Files
- **Files:** `permissions.ts`, `channels.service.ts`, `invites.service.ts`
- Consolidate into `permissions.ts` and have services call the single utility.

### #18 — Member Count Non-Atomic Under Concurrency
- **File:** `server/src/modules/servers/servers.service.ts`
- Use `SELECT COUNT(*)` as source of truth, or use serializable transaction for updates.

### #19 — Thread Channels Missing Foreign Keys
- **File:** `server/src/db/schema/channels.ts` (lines 26-28)
- Add FK constraints on `parentChannelId` and `originMessageId` with `ON DELETE CASCADE` or `SET NULL`.

### #20 — `passWithNoTests: true` Hides Missing Client Tests
- **File:** `client/vitest.config.ts`
- Remove `passWithNoTests` or add minimum test file count assertion in CI.

### #21 — SMTP Config Allows Partial Setup
- **File:** `server/src/config.ts`
- Add Zod `.refine()` to require all SMTP fields if any one is set.

### #22 — Nginx Missing Compression & Security Headers
- **File:** `nginx/nginx.conf`
- Add `gzip on`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict `Content-Security-Policy`.

---

## Low Severity

### #23 — Store Actions Call `get()` Multiple Times
- **Files:** `server.store.ts`, `channel.store.ts`, `dm.store.ts`
- Destructure `get()` once per action to avoid stale reads between calls.

### #24 — Missing ARIA Labels on Interactive Components
- **Files:** `ContextMenu.tsx`, `EmojiPicker.tsx`
- Add `role="menu"`, `role="menuitem"`, `aria-label` attributes.

### #25 — ReplyPreview Missing Keyboard Support
- **File:** `MessageItem.tsx`
- Add `role="button"`, `tabIndex={0}`, `onKeyDown` handler for Enter/Space.

### #26 — Attachment Filenames Not Sanitized
- **File:** `server/src/modules/messages/messages.service.ts`
- Sanitize to `[a-z0-9._-]` and truncate to 255 chars.

### #27 — Token Refresh Failure Has No User-Facing Feedback
- **File:** `client/src/api/client.ts` (lines 114-117)
- Show a toast notification before redirecting to login.

### #28 — `useMediaDevices` Async State Update After Unmount
- **File:** `client/src/hooks/useMediaDevices.ts`
- Use AbortController or a mounted ref to prevent post-unmount setState.

### #29 — No Test Coverage Thresholds in CI
- **Files:** vitest configs, `.github/workflows/ci.yml`
- Add `coverage.thresholds` in vitest config and run `test:coverage` in CI.

### #30 — Client-Only Fields on Shared Message Type
- **File:** `packages/shared/src/types/message.ts` (lines 27-29)
- Extract `_isPending`, `_isFailed`, `_tempId` into a separate `ClientMessage` type in the client package.

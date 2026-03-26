# Work Stream 6: WebSocket Event Validation (Client)

## Issues

### MEDIUM #11 — Unsafe Type Casts on Incoming WS Events
- **File:** `client/src/hooks/useWebSocket.ts` (lines 240, 261, 274, etc.)
- **Problem:** Incoming WebSocket event data is cast with `as` without runtime validation. Malformed server data silently becomes wrong types.
- **Approach:** Zod parsing (Option A — full runtime safety)

## Implementation Plan

1. **Define Zod schemas in `packages/shared/src/types/`** for all WS server-to-client events:
   - Co-locate with existing WS event type definitions in `ws-events.ts`
   - Export schemas alongside types so both server and client can use them
   - Each event's `.d` payload gets its own schema

2. **Parse incoming events in `useWebSocket.ts`**:
   - Replace `as` casts with `schema.parse()` or `schema.safeParse()`
   - On parse failure: log warning and skip the event (don't crash)

3. **Derive TypeScript types from schemas** where possible using `z.infer<>` to keep types and schemas in sync.

## Acceptance Criteria
- [ ] Zod schemas defined for all server-to-client WS events in shared package
- [ ] `useWebSocket.ts` uses `safeParse` for all incoming events
- [ ] Parse failures logged as warnings, event skipped
- [ ] Types derived from schemas where feasible
- [ ] Existing tests still pass
- [ ] Shared package builds cleanly

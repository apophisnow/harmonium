# Work Stream 2: Database Transaction Safety

## Issues

### CRITICAL #2 — Invite Acceptance Race Condition
- **File:** `server/src/modules/invites/invites.service.ts` (lines 180-248)
- **Problem:** Membership check and member insertion are separate queries with no transaction. Concurrent requests can create duplicate memberships.
- **Fix:** Wrap the entire `acceptInvite` flow in a `db.transaction()` call.

### CRITICAL #3 — No Transactions on Multi-Step Mutations
- **Problem:** Several multi-step operations have no transaction wrapping, risking partial failures:
  - **Server creation** (`servers.service.ts`) — creates server, adds member, creates @everyone role, creates default channel
  - **Invite acceptance** (`invites.service.ts`) — checks membership, increments use count, adds member
  - **Server deletion / member removal** — removes member, decrements count, updates server
- **Fix:** Wrap each multi-step mutation in `db.transaction()`. Pass the transaction `tx` object to inner queries.

## Acceptance Criteria
- [ ] `acceptInvite` is fully transactional
- [ ] `createServer` is fully transactional
- [ ] `removeMember` / `leaveServer` are transactional where they do count updates
- [ ] Existing tests still pass

# Work Stream 1: WebSocket Security

## Issues

### CRITICAL #1 — Missing WebSocket Server Subscription Auth
- **File:** `server/src/ws/gateway.ts` (lines 379-409)
- **Problem:** `SUBSCRIBE_SERVER` and `UNSUBSCRIBE_SERVER` handlers don't verify the user is a member of the server. Any authenticated user can receive real-time events from any server.
- **Fix:** Query `serverMembers` table to verify membership before calling `connectionManager.subscribeToServer()`. Send error `4003` and return if not a member.

### HIGH #7 — Invite Info Endpoint Leaks Too Much Data
- **File:** `server/src/modules/invites/invites.service.ts` (lines 137-162)
- **Route:** `GET /api/invites/:code` (public, no auth)
- **Problem:** Returns full server details, inviter profile, and exact member counts to unauthenticated users.
- **Fix:** Reduce returned data to: server name, server icon, and approximate member count (round to nearest 10 or bucket). Remove inviter details from public response.

## Acceptance Criteria
- [ ] `SUBSCRIBE_SERVER` rejects non-members with error code 4003
- [ ] `UNSUBSCRIBE_SERVER` also validates membership
- [ ] `GET /api/invites/:code` returns only server name, icon, and approximate member count
- [ ] Existing unit/integration tests still pass
- [ ] Add test cases for subscription rejection and reduced invite info

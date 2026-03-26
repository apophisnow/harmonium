# Work Stream 3: Auth Hardening

## Issues

### CRITICAL #4 — Client Token Refresh Race Condition
- **File:** `client/src/api/client.ts` (lines 76-122)
- **Problem:** Global `isRefreshing` and `failedQueue` variables can lose queued promises under high concurrency. Multiple 401s can trigger parallel refresh attempts.
- **Fix:** Replace with a single refresh promise that all concurrent 401 handlers await. Store the promise itself (not a boolean flag) so subsequent interceptors chain on the same refresh call.

### HIGH #5 — No Rate Limiting on Password Change / Token Refresh
- **Files:** `server/src/modules/auth/auth.routes.ts`, `server/src/modules/users/users.routes.ts`
- **Problem:** Password change and token refresh endpoints have no rate limiting, enabling brute force.
- **Fix:** Add rate limit config: password change 5/min, token refresh 10/min. Use the existing rate limiting middleware pattern already in auth routes.

## Acceptance Criteria
- [ ] Token refresh uses a shared promise pattern — only one refresh in-flight at a time
- [ ] Password change endpoint rate limited to 5 requests/min
- [ ] Token refresh endpoint rate limited to 10 requests/min
- [ ] Existing tests still pass

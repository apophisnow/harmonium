# Work Stream 5: Infrastructure & CI Fixes

## Issues

### HIGH #8 — MEDIASOUP_ANNOUNCED_IP Defaults to 127.0.0.1 in Prod
- **File:** `docker-compose.prod.yml`
- **Problem:** Default value for `MEDIASOUP_ANNOUNCED_IP` is `127.0.0.1`, which breaks voice/video in any non-localhost production deployment.
- **Fix:** Remove the default so the variable is required. Add a comment documenting that it must be set to the server's public IP.

### HIGH #9 — CI Doesn't Run DB Migrations Before Integration Tests
- **File:** `.github/workflows/ci.yml` (lines 94-117)
- **Problem:** Integration tests assume the database schema exists, but migrations aren't applied in CI.
- **Fix:** Add a migration/db:push step after building the server and before starting it for integration tests.

### HIGH #10 — Dead crypto.js Export in Shared Package
- **File:** `packages/shared/src/index.ts` (line ~22)
- **Problem:** Exports from `./types/crypto.js` but the file doesn't exist. Could cause build failures.
- **Fix:** Remove the dead export line.

## Acceptance Criteria
- [ ] `docker-compose.prod.yml` requires `MEDIASOUP_ANNOUNCED_IP` (no default)
- [ ] CI workflow applies migrations before integration tests
- [ ] Dead `crypto.js` export removed from shared index
- [ ] CI pipeline passes

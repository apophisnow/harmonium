# Work Stream 4: Route-Level Permission Checks

## Issues

### HIGH #6 — Channel Routes Missing Defense-in-Depth
- **File:** `server/src/modules/channels/channels.routes.ts` (lines 22-96)
- **Problem:** Channel create/update/delete routes rely entirely on service-layer permission checks. No `preHandler` middleware validates permissions at the route level.
- **Fix:** Add `preHandler` hooks that verify:
  - Server membership for all channel routes
  - `MANAGE_CHANNELS` permission for create/update/delete
  - Use the existing permission utilities in `server/src/utils/permissions.ts`

## Acceptance Criteria
- [ ] `POST /api/servers/:serverId/channels` has preHandler checking MANAGE_CHANNELS
- [ ] `PATCH /api/channels/:channelId` has preHandler checking MANAGE_CHANNELS
- [ ] `DELETE /api/channels/:channelId` has preHandler checking MANAGE_CHANNELS
- [ ] Non-members get 403 before hitting service layer
- [ ] Existing tests still pass

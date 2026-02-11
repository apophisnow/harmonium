# Task 11: Invite Module

## Objective
Implement invite link creation, validation, usage (joining a server), listing, and deletion.

## Dependencies
- Task 7 (server & member module) - need addMemberToServer function, membership checks

## Pre-existing Files to Read
- `server/src/db/schema/invites.ts` - invites table
- `server/src/db/schema/servers.ts` - servers, serverMembers tables
- `server/src/modules/servers/servers.service.ts` - addMemberToServer function, membership checks
- `server/src/utils/permissions.ts` - requirePermission
- `server/src/utils/snowflake.ts` - Not needed (invite codes are random strings)
- `server/src/utils/errors.ts` - Error classes
- `server/src/ws/pubsub.ts` - PubSubManager (for MEMBER_JOIN broadcast)
- `packages/shared/src/types/invite.ts` - Invite types
- `packages/shared/src/permissions.ts` - CREATE_INVITE, MANAGE_SERVER

## Files to Create

### 1. `server/src/modules/invites/invites.schemas.ts`
Zod schemas:
- `createInviteSchema`: { maxUses?: number (nullable, 0 = unlimited), expiresIn?: number (seconds, nullable, 0 = never) }
- `inviteParamsSchema`: { code: string }

### 2. `server/src/modules/invites/invites.service.ts`
Functions:
- `createInvite(serverId: string, inviterId: string, input)`:
  - Generate random 8-character alphanumeric code (use crypto.randomBytes, base62 encode)
  - Calculate expiresAt from expiresIn seconds (null if 0 or not provided)
  - Insert into invites table
  - Return invite object

- `getInviteInfo(code: string)`:
  - Look up invite by code
  - JOIN servers for name, icon, member count
  - JOIN users for inviter info
  - Return invite with server and inviter data
  - Do NOT require authentication (this is for the invite landing page)

- `getServerInvites(serverId: string)`:
  - List all invites for a server with inviter user data
  - Include expired/used-up invites (let the client filter)

- `acceptInvite(code: string, userId: string)`:
  - Look up invite
  - Validate: not expired (expiresAt > now or null), not exceeded maxUses (useCount < maxUses or null)
  - Check user not already a member of the server
  - Increment useCount
  - Call addMemberToServer (from servers service) to add user to server_members
  - Broadcast MEMBER_JOIN event via pub/sub
  - Return server data

- `deleteInvite(code: string, userId: string, serverId: string)`:
  - Verify user is invite creator OR has MANAGE_SERVER permission
  - Delete invite

### 3. `server/src/modules/invites/invites.routes.ts`
Routes:

Server-scoped (prefix `/api/servers/:serverId/invites`):
- `POST /` - Create invite (requires CREATE_INVITE permission)
- `GET /` - List server invites (requires MANAGE_SERVER)

Invite-scoped (prefix `/api/invites`):
- `GET /:code` - Get invite info (NO auth required - public endpoint for invite preview)
- `POST /:code/accept` - Accept invite and join server (requires auth)
- `DELETE /:code` - Delete invite (creator or MANAGE_SERVER)

### 4. Update `server/src/app.ts`
Register invites route module.

## Invite Code Generation
Generate URL-safe random codes:
```typescript
import crypto from 'crypto';

function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}
```

## Acceptance Criteria
- [ ] POST creates invite with random 8-char code
- [ ] Optional maxUses and expiresIn work correctly
- [ ] GET /:code returns invite info WITHOUT auth (public preview)
- [ ] POST /:code/accept joins user to server
- [ ] Expired invites rejected with appropriate error
- [ ] Max-uses invites rejected when exceeded
- [ ] Already-a-member returns appropriate response (409 or just returns server)
- [ ] useCount incremented on accept
- [ ] MEMBER_JOIN broadcast via WebSocket
- [ ] DELETE works for creator and MANAGE_SERVER holders
- [ ] GET server invites requires MANAGE_SERVER
- [ ] TypeScript compilation passes

# Task 7: Server (Guild) & Member Module + User Routes

## Objective
Implement server CRUD (create, read, update, delete guilds), member management (join, leave, list members), and user profile routes. When creating a server, automatically create a default @everyone role and a "general" text channel.

## Dependencies
- Task 5 (auth module) - for authentication middleware
- Task 6 (WebSocket gateway) - for broadcasting MEMBER_JOIN/MEMBER_LEAVE events

## Pre-existing Files to Read
- `server/src/app.ts` - App factory (register new route modules here)
- `server/src/plugins/auth.ts` - The `authenticate` preHandler hook
- `server/src/db/index.ts` - Database connection
- `server/src/db/schema/servers.ts` - servers, serverMembers tables
- `server/src/db/schema/roles.ts` - roles table (for creating @everyone)
- `server/src/db/schema/channels.ts` - channels table (for creating "general")
- `server/src/db/schema/users.ts` - users table
- `server/src/utils/snowflake.ts` - ID generator
- `server/src/utils/errors.ts` - Error classes
- `server/src/ws/index.ts` - ConnectionManager (for broadcasting)
- `server/src/ws/pubsub.ts` - PubSubManager (for publishing events)
- `packages/shared/src/types/server.ts` - Server, ServerMember types
- `packages/shared/src/types/user.ts` - User types
- `packages/shared/src/permissions.ts` - DEFAULT_PERMISSIONS, Permission constants

## Files to Create

### 1. `server/src/modules/servers/servers.schemas.ts`
Zod schemas:
- `createServerSchema`: { name: string (1-100 chars) }
- `updateServerSchema`: { name?: string, iconUrl?: string }
- `serverParamsSchema`: { serverId: string }

### 2. `server/src/modules/servers/servers.service.ts`
Functions:
- `createServer(userId: string, input: CreateServerInput)`:
  1. Generate snowflake ID for server
  2. Insert server with owner_id = userId
  3. Add creator to server_members
  4. Create @everyone role (isDefault: true, permissions: DEFAULT_PERMISSIONS, position: 0)
  5. Create "general" text channel (position: 0)
  6. Return server object

- `getUserServers(userId: string)`:
  - Query servers the user is a member of via JOIN on server_members
  - Return array of Server objects

- `getServerById(serverId: string, userId: string)`:
  - Verify user is a member (throw ForbiddenError if not)
  - Return server with member count

- `updateServer(serverId: string, userId: string, input: UpdateServerInput)`:
  - Verify user is the owner (throw ForbiddenError if not)
  - Update server name/icon
  - Return updated server

- `deleteServer(serverId: string, userId: string)`:
  - Verify user is the owner
  - Delete server (cascades handle members, channels, messages, etc.)

- `getServerMembers(serverId: string, userId: string)`:
  - Verify user is a member
  - Query server_members JOIN users, include role IDs from member_roles
  - Return array of members with user data

- `leaveServer(serverId: string, userId: string)`:
  - Check user is not the owner (owners must delete or transfer, cannot leave)
  - Remove from server_members (cascades remove member_roles)
  - Publish MEMBER_LEAVE event via pub/sub

### 3. `server/src/modules/servers/servers.routes.ts`
Fastify plugin registered at prefix `/api/servers`. All routes require authentication.

Routes:
- `POST /` - Create server
- `GET /` - List user's servers
- `GET /:serverId` - Get server details (requires membership)
- `PATCH /:serverId` - Update server (owner only)
- `DELETE /:serverId` - Delete server (owner only)
- `GET /:serverId/members` - List members
- `DELETE /:serverId/members/@me` - Leave server

### 4. `server/src/modules/users/users.schemas.ts`
- `updateUserSchema`: { username?: string, aboutMe?: string, customStatus?: string }

### 5. `server/src/modules/users/users.service.ts`
- `getCurrentUser(userId: string)`: Get full user from DB (include email)
- `getUserById(userId: string)`: Get public user (exclude email, passwordHash)
- `updateUser(userId: string, input)`: Update profile fields, return updated user

### 6. `server/src/modules/users/users.routes.ts`
Plugin at prefix `/api/users`. All routes require authentication.
- `GET /@me` - Get current authenticated user
- `PATCH /@me` - Update profile
- `GET /:userId` - Get public user profile

### 7. Update `server/src/app.ts`
Register servers and users route modules.

## WebSocket Events to Publish
When a member joins (via invite module, which will call a shared function):
```typescript
pubsub.publishToServer(serverId, {
  op: 'MEMBER_JOIN',
  d: { serverId, member: { userId, user: publicUser, joinedAt, ... } }
});
```

When a member leaves:
```typescript
pubsub.publishToServer(serverId, {
  op: 'MEMBER_LEAVE',
  d: { serverId, userId }
});
```

Export a `addMemberToServer(serverId, userId)` function that other modules (invites) can call.

## Acceptance Criteria
- [ ] POST /api/servers creates server with @everyone role and "general" channel
- [ ] GET /api/servers returns only servers the user belongs to
- [ ] GET /api/servers/:id requires membership, returns server details
- [ ] PATCH /api/servers/:id only works for owner
- [ ] DELETE /api/servers/:id only works for owner, cascades everything
- [ ] GET /api/servers/:id/members returns member list with user data
- [ ] DELETE /api/servers/:id/members/@me removes member (not owner)
- [ ] GET /api/users/@me returns full user (with email)
- [ ] GET /api/users/:id returns public user (no email/password)
- [ ] PATCH /api/users/@me updates profile
- [ ] WebSocket events broadcast on member changes
- [ ] All IDs serialized as strings in JSON responses
- [ ] TypeScript compilation passes

# Task 8: Roles & Permissions Module

## Objective
Implement role CRUD, role assignment to members, and the permission calculation engine. The engine must compute effective permissions by combining server-level role permissions with channel-level overrides, matching Discord's permission model.

## Dependencies
- Task 7 (server & member module) - servers and members must exist

## Pre-existing Files to Read
- `server/src/db/schema/roles.ts` - roles, memberRoles tables
- `server/src/db/schema/channels.ts` - channelPermissionOverrides table
- `server/src/db/schema/servers.ts` - servers, serverMembers tables
- `server/src/modules/servers/servers.service.ts` - membership checks
- `server/src/utils/errors.ts` - Error classes
- `server/src/utils/snowflake.ts` - ID generator
- `packages/shared/src/permissions.ts` - Permission bitflags, hasPermission, computeChannelPermissions

## Files to Create

### 1. `server/src/utils/permissions.ts` - Permission Calculation Engine
The core permission engine used by ALL other modules for authorization.

```typescript
import { Permission, ALL_PERMISSIONS, hasPermission } from '@discord-clone/shared';

/**
 * Compute a member's effective permissions in a server.
 *
 * Calculation order:
 * 1. Start with @everyone role permissions
 * 2. OR all permissions from the member's assigned roles
 * 3. If ADMINISTRATOR bit is set, return ALL permissions
 * 4. Server owner always gets ALL permissions
 */
export async function computeServerPermissions(
  db: Database,
  serverId: string,
  userId: string
): Promise<bigint>;

/**
 * Compute a member's effective permissions in a specific channel.
 *
 * Starts with server permissions, then applies channel overrides:
 * 1. Get server-level permissions (from computeServerPermissions)
 * 2. If ADMINISTRATOR, return ALL (overrides can't remove admin)
 * 3. Apply @everyone role channel override (deny, then allow)
 * 4. Apply overrides for each of the member's roles (combine deny, combine allow, apply deny then allow)
 * 5. Apply member-specific override (deny, then allow)
 */
export async function computeChannelPermissions(
  db: Database,
  serverId: string,
  channelId: string,
  userId: string
): Promise<bigint>;

/**
 * Middleware factory: creates a preHandler that checks a specific permission.
 * Usage: { preHandler: requirePermission(Permission.MANAGE_CHANNELS) }
 *
 * Expects request.params to have serverId (and optionally channelId).
 * For channel-specific permissions, use requireChannelPermission.
 */
export function requirePermission(permission: bigint): FastifyPreHandler;

export function requireChannelPermission(permission: bigint): FastifyPreHandler;
```

### 2. `server/src/modules/roles/roles.schemas.ts`
Zod schemas:
- `createRoleSchema`: { name: string (1-100), color?: number, permissions?: string (bigint as string) }
- `updateRoleSchema`: { name?: string, color?: number, permissions?: string, position?: number }
- `roleParamsSchema`: { serverId: string, roleId: string }

### 3. `server/src/modules/roles/roles.service.ts`
Functions:
- `createRole(serverId: string, input)`: Generate ID, insert with next position, return role
- `getServerRoles(serverId: string)`: All roles ordered by position
- `updateRole(serverId: string, roleId: string, input)`: Update fields. Cannot modify @everyone's isDefault status. Position changes should reorder other roles.
- `deleteRole(serverId: string, roleId: string)`: Cannot delete @everyone role. Cascade removes memberRoles.
- `assignRole(serverId: string, userId: string, roleId: string)`: Add to memberRoles. Verify membership and role exists.
- `removeRole(serverId: string, userId: string, roleId: string)`: Remove from memberRoles. Cannot remove @everyone.
- `getMemberRoles(serverId: string, userId: string)`: Get all roles for a member.

### 4. `server/src/modules/roles/roles.routes.ts`
Plugin at prefix `/api/servers/:serverId/roles`. All require auth + membership.

Routes:
- `POST /` - Create role (requires MANAGE_ROLES)
- `GET /` - List server roles (requires membership)
- `PATCH /:roleId` - Update role (requires MANAGE_ROLES)
- `DELETE /:roleId` - Delete role (requires MANAGE_ROLES)
- `PUT /:roleId/members/:userId` - Assign role to member (requires MANAGE_ROLES)
- `DELETE /:roleId/members/:userId` - Remove role from member (requires MANAGE_ROLES)

## Permission Bits Reference (from shared package)
```
ADMINISTRATOR    = 1 << 0
MANAGE_SERVER    = 1 << 1
MANAGE_CHANNELS  = 1 << 2
MANAGE_ROLES     = 1 << 3
MANAGE_MESSAGES  = 1 << 4
SEND_MESSAGES    = 1 << 5
READ_MESSAGES    = 1 << 6
CONNECT          = 1 << 7
SPEAK            = 1 << 8
CREATE_INVITE    = 1 << 9
KICK_MEMBERS     = 1 << 10
BAN_MEMBERS      = 1 << 11
ATTACH_FILES     = 1 << 12
MENTION_EVERYONE = 1 << 13
```

## Acceptance Criteria
- [ ] Permission engine correctly computes server-level permissions
- [ ] Permission engine correctly applies channel overrides (deny then allow)
- [ ] Server owner always has ALL_PERMISSIONS regardless of roles
- [ ] ADMINISTRATOR permission grants all permissions
- [ ] requirePermission middleware blocks unauthorized actions with 403
- [ ] Role CRUD works (create, list, update, delete)
- [ ] Cannot delete @everyone role
- [ ] Role assignment/removal works
- [ ] Position-based ordering maintained
- [ ] All bigint permissions serialized as strings in responses
- [ ] TypeScript compilation passes

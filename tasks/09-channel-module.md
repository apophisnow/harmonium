# Task 9: Channel Module

## Objective
Implement channel and category CRUD, channel listing per server (grouped by category), and channel permission override management. Text and voice channel types supported.

## Dependencies
- Task 7 (server module) - server membership validation
- Task 8 (roles/permissions) - permission checks, channel permission overrides

## Pre-existing Files to Read
- `server/src/db/schema/channels.ts` - channels, channelCategories, channelPermissionOverrides tables
- `server/src/modules/servers/servers.service.ts` - membership checks
- `server/src/utils/permissions.ts` - requirePermission, requireChannelPermission, computeChannelPermissions
- `server/src/utils/snowflake.ts` - ID generator
- `server/src/utils/errors.ts` - Error classes
- `server/src/ws/pubsub.ts` - PubSubManager for broadcasting events
- `packages/shared/src/types/channel.ts` - Channel, ChannelCategory types
- `packages/shared/src/ws-events.ts` - CHANNEL_CREATE, CHANNEL_UPDATE, CHANNEL_DELETE events

## Files to Create

### 1. `server/src/modules/channels/channels.schemas.ts`
Zod schemas:
- `createChannelSchema`: { name: string (1-100, lowercase, no spaces - convert spaces to hyphens), type: 'text' | 'voice', categoryId?: string, isPrivate?: boolean }
- `updateChannelSchema`: { name?: string, topic?: string, position?: number, categoryId?: string | null }
- `createCategorySchema`: { name: string (1-100) }
- `updateCategorySchema`: { name?: string, position?: number }
- `permissionOverrideSchema`: { targetType: 'role' | 'member', targetId: string, allow: string, deny: string }

### 2. `server/src/modules/channels/channels.service.ts`
Functions:
- `createChannel(serverId: string, input)`: Validate server exists, generate ID, insert channel. Broadcast CHANNEL_CREATE.
- `getServerChannels(serverId: string, userId: string)`: Get all channels in server, grouped by category. Filter out channels the user doesn't have READ_MESSAGES permission for (private channels they lack access to). Return structure: `{ uncategorized: Channel[], categories: { category: ChannelCategory, channels: Channel[] }[] }`
- `updateChannel(channelId: string, input)`: Update fields, broadcast CHANNEL_UPDATE.
- `deleteChannel(channelId: string)`: Delete channel, broadcast CHANNEL_DELETE.
- `createCategory(serverId: string, input)`: Create channel category.
- `updateCategory(categoryId: string, input)`: Update category.
- `deleteCategory(categoryId: string)`: Delete category, set categoryId to null on orphaned channels.
- `setPermissionOverride(channelId: string, input)`: Upsert a permission override for a role or member on a channel.
- `deletePermissionOverride(channelId: string, targetType: string, targetId: string)`: Remove override.
- `getChannelPermissionOverrides(channelId: string)`: List all overrides for a channel.

### 3. `server/src/modules/channels/channels.routes.ts`
Two sets of routes:

Server-scoped (prefix `/api/servers/:serverId`):
- `POST /channels` - Create channel (MANAGE_CHANNELS)
- `GET /channels` - List channels (membership required)
- `POST /categories` - Create category (MANAGE_CHANNELS)

Channel-scoped (prefix `/api/channels`):
- `PATCH /:channelId` - Update channel (MANAGE_CHANNELS)
- `DELETE /:channelId` - Delete channel (MANAGE_CHANNELS)
- `PUT /:channelId/permissions` - Set permission override (MANAGE_ROLES)
- `DELETE /:channelId/permissions/:targetType/:targetId` - Delete override (MANAGE_ROLES)

Category-scoped (prefix `/api/categories`):
- `PATCH /:categoryId` - Update category (MANAGE_CHANNELS)
- `DELETE /:categoryId` - Delete category (MANAGE_CHANNELS)

### 4. Update `server/src/app.ts`
Register channels route module.

## Channel Name Rules
- Convert to lowercase
- Replace spaces with hyphens
- Only allow: a-z, 0-9, hyphens, underscores
- Max 100 characters

## Acceptance Criteria
- [ ] Create text and voice channels within a server
- [ ] List channels grouped by category, filtered by user permissions
- [ ] Update channel name, topic, position, category
- [ ] Delete channel (with cascade to messages)
- [ ] Create/update/delete categories
- [ ] Deleting a category sets channels to uncategorized (not deleted)
- [ ] Set/delete channel permission overrides for roles and members
- [ ] CHANNEL_CREATE/UPDATE/DELETE events broadcast via WebSocket
- [ ] All operations require appropriate permissions
- [ ] Channel names normalized (lowercase, hyphens)
- [ ] TypeScript compilation passes

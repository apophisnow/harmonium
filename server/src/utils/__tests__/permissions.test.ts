import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Permission, ALL_PERMISSIONS } from '@harmonium/shared';
import { ForbiddenError, NotFoundError } from '../errors.js';

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: any, b: any) => ({ field: a, value: b })),
  and: vi.fn((...args: any[]) => args),
  sql: vi.fn((strings: any, ...values: any[]) => ({ strings, values })),
}));

// Mock DB module
vi.mock('../../db/index.js', () => ({
  getDb: vi.fn(),
  schema: {
    servers: { id: 'servers.id', ownerId: 'servers.ownerId' },
    serverMembers: { serverId: 'serverMembers.serverId', userId: 'serverMembers.userId' },
    roles: { id: 'roles.id', serverId: 'roles.serverId', isDefault: 'roles.isDefault', permissions: 'roles.permissions' },
    memberRoles: { serverId: 'memberRoles.serverId', userId: 'memberRoles.userId', roleId: 'memberRoles.roleId' },
    channels: { id: 'channels.id' },
    channelPermissionOverrides: { channelId: 'channelPermissionOverrides.channelId' },
    dmChannelMembers: { channelId: 'dmChannelMembers.channelId', userId: 'dmChannelMembers.userId' },
  },
}));

import { getDb } from '../../db/index.js';
import {
  computeServerPermissions,
  computeChannelPermissions,
  requirePermission,
  requireChannelPermission,
} from '../permissions.js';

const mockedGetDb = vi.mocked(getDb);

function createMockDb(overrides: any = {}) {
  // serverMemberWhere handles the server+membership JOIN query (query 1 in computeServerPermissions)
  const serverMemberWhere = vi.fn().mockResolvedValue([]);
  // roleWhere handles the roles query (query 2 in computeServerPermissions)
  const roleWhere = vi.fn().mockResolvedValue([]);
  // channelMemberRoleWhere handles the member roles query inside computeChannelPermissions
  const channelMemberRoleWhere = vi.fn().mockResolvedValue([]);

  const mockDb: any = {
    query: {
      servers: { findFirst: vi.fn() },
      serverMembers: { findFirst: vi.fn() },
      roles: { findFirst: vi.fn() },
      channels: { findFirst: vi.fn() },
      channelPermissionOverrides: { findMany: vi.fn().mockResolvedValue([]) },
      dmChannelMembers: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    _serverMemberWhere: serverMemberWhere,
    _roleWhere: roleWhere,
    _channelMemberRoleWhere: channelMemberRoleWhere,
    ...overrides,
  };

  // Route .where() based on what table was passed to .from():
  // - from(servers) => serverMemberWhere
  // - from(roles) => roleWhere
  // - from(memberRoles) => channelMemberRoleWhere
  mockDb.select.mockImplementation(() => {
    let whereToUse = channelMemberRoleWhere; // default fallback
    const chain: any = {};
    chain.from = vi.fn().mockImplementation((table: any) => {
      if (table === 'servers.id' || table?.id === 'servers.id') {
        whereToUse = serverMemberWhere;
      } else if (table === 'roles.id' || table?.id === 'roles.id') {
        whereToUse = roleWhere;
      } else {
        whereToUse = channelMemberRoleWhere;
      }
      return chain;
    });
    chain.leftJoin = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    // Use a getter so it resolves the correct where based on from() call
    Object.defineProperty(chain, 'where', {
      get() { return whereToUse; },
    });
    return chain;
  });

  return mockDb;
}

describe('permissions', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockedGetDb.mockReturnValue(mockDb);
  });

  describe('computeServerPermissions', () => {
    it('owner gets ALL_PERMISSIONS', async () => {
      // Query 1: server+member JOIN returns owner match
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 1n, memberUserId: 1n }]);

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(ALL_PERMISSIONS);
    });

    it('throws NotFoundError when server not found', async () => {
      // Query 1: no rows => server not found
      mockDb._serverMemberWhere.mockResolvedValue([]);

      await expect(computeServerPermissions(mockDb, '999', '1')).rejects.toThrow(NotFoundError);
      await expect(computeServerPermissions(mockDb, '999', '1')).rejects.toThrow('Server not found');
    });

    it('throws ForbiddenError for non-member', async () => {
      // Query 1: server found but memberUserId is null (not a member)
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: null }]);

      await expect(computeServerPermissions(mockDb, '100', '1')).rejects.toThrow(ForbiddenError);
      await expect(computeServerPermissions(mockDb, '100', '1')).rejects.toThrow(
        'You are not a member of this server',
      );
    });

    it('basic member gets @everyone role permissions', async () => {
      const everyonePerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;

      // Query 1: server+member found
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: 1n }]);
      // Query 2: only @everyone role
      mockDb._roleWhere.mockResolvedValue([
        { permissions: everyonePerms, isDefault: true },
      ]);

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(everyonePerms);
    });

    it('member with additional role gets OR-ed permissions', async () => {
      const everyonePerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
      const extraPerms = Permission.MANAGE_MESSAGES;

      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: 1n }]);
      mockDb._roleWhere.mockResolvedValue([
        { permissions: everyonePerms, isDefault: true },
        { permissions: extraPerms, isDefault: false },
      ]);

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(everyonePerms | extraPerms);
    });

    it('ADMINISTRATOR in any role grants ALL_PERMISSIONS', async () => {
      const everyonePerms = Permission.SEND_MESSAGES;

      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: 1n }]);
      mockDb._roleWhere.mockResolvedValue([
        { permissions: everyonePerms, isDefault: true },
        { permissions: Permission.ADMINISTRATOR, isDefault: false },
      ]);

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(ALL_PERMISSIONS);
    });
  });

  describe('computeChannelPermissions', () => {
    it('admin bypasses channel overrides', async () => {
      // Server owner => ALL_PERMISSIONS from computeServerPermissions
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 1n, memberUserId: 1n }]);

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      expect(result).toBe(ALL_PERMISSIONS);
      // Should not even query for channel overrides
      expect(mockDb.query.channelPermissionOverrides.findMany).not.toHaveBeenCalled();
    });

    it('applies @everyone role channel override', async () => {
      const everyonePerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
      const everyoneRoleId = 50n;

      // computeServerPermissions queries
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: 1n }]);
      mockDb._roleWhere.mockResolvedValue([
        { permissions: everyonePerms, isDefault: true },
      ]);

      // computeChannelPermissions parallel queries
      mockDb.query.channelPermissionOverrides.findMany.mockResolvedValue([
        {
          targetType: 'role',
          targetId: everyoneRoleId,
          allow: 0n,
          deny: Permission.SEND_MESSAGES,
        },
      ]);
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: everyoneRoleId,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      // SEND_MESSAGES should be denied, READ_MESSAGES should remain
      expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
      expect(result & Permission.SEND_MESSAGES).toBe(0n);
    });

    it('applies member role overrides', async () => {
      const everyonePerms = Permission.READ_MESSAGES;
      const everyoneRoleId = 50n;
      const memberRoleId = 60n;

      // computeServerPermissions queries
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: 1n }]);
      mockDb._roleWhere.mockResolvedValue([
        { permissions: everyonePerms, isDefault: true },
      ]);

      // computeChannelPermissions parallel queries
      mockDb.query.channelPermissionOverrides.findMany.mockResolvedValue([
        {
          targetType: 'role',
          targetId: memberRoleId,
          allow: Permission.SEND_MESSAGES,
          deny: 0n,
        },
      ]);
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: everyoneRoleId,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });
      // Member has roleId 60 (from the select().from(memberRoles).where() in computeChannelPermissions)
      mockDb._channelMemberRoleWhere.mockResolvedValue([{ roleId: memberRoleId }]);

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      // Should have READ_MESSAGES from @everyone + SEND_MESSAGES from role override
      expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
      expect(result & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
    });

    it('applies member-specific override', async () => {
      const everyonePerms = Permission.READ_MESSAGES | Permission.SEND_MESSAGES;
      const everyoneRoleId = 50n;
      const userId = 1n;

      // computeServerPermissions queries
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: 1n }]);
      mockDb._roleWhere.mockResolvedValue([
        { permissions: everyonePerms, isDefault: true },
      ]);

      // computeChannelPermissions parallel queries
      mockDb.query.channelPermissionOverrides.findMany.mockResolvedValue([
        {
          targetType: 'member',
          targetId: userId,
          allow: Permission.MANAGE_MESSAGES,
          deny: Permission.SEND_MESSAGES,
        },
      ]);
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: everyoneRoleId,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
      expect(result & Permission.SEND_MESSAGES).toBe(0n);
      expect(result & Permission.MANAGE_MESSAGES).toBe(Permission.MANAGE_MESSAGES);
    });
  });

  describe('requirePermission', () => {
    it('passes when user has the required permission', async () => {
      // Owner has ALL_PERMISSIONS
      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 1n, memberUserId: 1n }]);

      const handler = requirePermission(Permission.SEND_MESSAGES);
      const request = {
        params: { serverId: '100' },
        user: { userId: '1' },
      } as any;
      const reply = {} as any;

      // Should not throw
      await expect(handler(request, reply)).resolves.toBeUndefined();
    });

    it('throws ForbiddenError when user lacks permission', async () => {
      const everyonePerms = Permission.READ_MESSAGES; // no MANAGE_ROLES

      mockDb._serverMemberWhere.mockResolvedValue([{ ownerId: 999n, memberUserId: 1n }]);
      mockDb._roleWhere.mockResolvedValue([
        { permissions: everyonePerms, isDefault: true },
      ]);

      const handler = requirePermission(Permission.MANAGE_ROLES);
      const request = {
        params: { serverId: '100' },
        user: { userId: '1' },
      } as any;
      const reply = {} as any;

      await expect(handler(request, reply)).rejects.toThrow(ForbiddenError);
      await expect(handler(request, reply)).rejects.toThrow(
        'You do not have permission to perform this action',
      );
    });
  });
});

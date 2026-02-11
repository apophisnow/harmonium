import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Permission, ALL_PERMISSIONS } from '@harmonium/shared';
import { ForbiddenError, NotFoundError } from '../errors.js';

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: any, b: any) => ({ field: a, value: b })),
  and: vi.fn((...args: any[]) => args),
}));

// Mock DB module
vi.mock('../../db/index.js', () => ({
  getDb: vi.fn(),
  schema: {
    servers: { id: 'servers.id' },
    serverMembers: { serverId: 'serverMembers.serverId', userId: 'serverMembers.userId' },
    roles: { id: 'roles.id', serverId: 'roles.serverId', isDefault: 'roles.isDefault' },
    memberRoles: { serverId: 'memberRoles.serverId', userId: 'memberRoles.userId', roleId: 'memberRoles.roleId' },
    channels: { id: 'channels.id' },
    channelPermissionOverrides: { channelId: 'channelPermissionOverrides.channelId' },
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
  const mockWhere = vi.fn().mockResolvedValue([]);
  return {
    query: {
      servers: { findFirst: vi.fn() },
      serverMembers: { findFirst: vi.fn() },
      roles: { findFirst: vi.fn() },
      channelPermissionOverrides: { findMany: vi.fn().mockResolvedValue([]) },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: mockWhere,
    ...overrides,
  } as any;
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
      mockDb.query.servers.findFirst.mockResolvedValue({
        id: 100n,
        ownerId: 1n,
      });

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(ALL_PERMISSIONS);
    });

    it('throws NotFoundError when server not found', async () => {
      mockDb.query.servers.findFirst.mockResolvedValue(undefined);

      await expect(computeServerPermissions(mockDb, '999', '1')).rejects.toThrow(NotFoundError);
      await expect(computeServerPermissions(mockDb, '999', '1')).rejects.toThrow('Server not found');
    });

    it('throws ForbiddenError for non-member', async () => {
      mockDb.query.servers.findFirst.mockResolvedValue({
        id: 100n,
        ownerId: 999n, // different owner
      });
      mockDb.query.serverMembers.findFirst.mockResolvedValue(undefined);

      await expect(computeServerPermissions(mockDb, '100', '1')).rejects.toThrow(ForbiddenError);
      await expect(computeServerPermissions(mockDb, '100', '1')).rejects.toThrow(
        'You are not a member of this server',
      );
    });

    it('basic member gets @everyone role permissions', async () => {
      const everyonePerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;

      mockDb.query.servers.findFirst.mockResolvedValue({
        id: 100n,
        ownerId: 999n,
      });
      mockDb.query.serverMembers.findFirst.mockResolvedValue({
        serverId: 100n,
        userId: 1n,
      });
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: 50n,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });
      // No additional roles
      mockDb.where.mockResolvedValue([]);

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(everyonePerms);
    });

    it('member with additional role gets OR-ed permissions', async () => {
      const everyonePerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
      const extraPerms = Permission.MANAGE_MESSAGES;

      mockDb.query.servers.findFirst.mockResolvedValue({
        id: 100n,
        ownerId: 999n,
      });
      mockDb.query.serverMembers.findFirst.mockResolvedValue({
        serverId: 100n,
        userId: 1n,
      });
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: 50n,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });
      // Additional role with extra permissions
      mockDb.where.mockResolvedValue([
        { role: { permissions: extraPerms } },
      ]);

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(everyonePerms | extraPerms);
    });

    it('ADMINISTRATOR in any role grants ALL_PERMISSIONS', async () => {
      const everyonePerms = Permission.SEND_MESSAGES;

      mockDb.query.servers.findFirst.mockResolvedValue({
        id: 100n,
        ownerId: 999n,
      });
      mockDb.query.serverMembers.findFirst.mockResolvedValue({
        serverId: 100n,
        userId: 1n,
      });
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: 50n,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });
      // Role with ADMINISTRATOR
      mockDb.where.mockResolvedValue([
        { role: { permissions: Permission.ADMINISTRATOR } },
      ]);

      const result = await computeServerPermissions(mockDb, '100', '1');
      expect(result).toBe(ALL_PERMISSIONS);
    });
  });

  describe('computeChannelPermissions', () => {
    it('admin bypasses channel overrides', async () => {
      // Server owner => ALL_PERMISSIONS
      mockDb.query.servers.findFirst.mockResolvedValue({
        id: 100n,
        ownerId: 1n,
      });

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      expect(result).toBe(ALL_PERMISSIONS);
      // Should not even query for channel overrides
      expect(mockDb.query.channelPermissionOverrides.findMany).not.toHaveBeenCalled();
    });

    it('applies @everyone role channel override', async () => {
      const everyonePerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
      const everyoneRoleId = 50n;

      mockDb.query.servers.findFirst.mockResolvedValue({ id: 100n, ownerId: 999n });
      mockDb.query.serverMembers.findFirst.mockResolvedValue({ serverId: 100n, userId: 1n });

      // For computeServerPermissions: @everyone role
      // For computeChannelPermissions: @everyone role again
      // Both calls use roles.findFirst
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: everyoneRoleId,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });

      // No additional member roles (from computeServerPermissions and computeChannelPermissions)
      mockDb.where.mockResolvedValue([]);

      // Channel overrides: deny SEND_MESSAGES for @everyone
      mockDb.query.channelPermissionOverrides.findMany.mockResolvedValue([
        {
          targetType: 'role',
          targetId: everyoneRoleId,
          allow: 0n,
          deny: Permission.SEND_MESSAGES,
        },
      ]);

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      // SEND_MESSAGES should be denied, READ_MESSAGES should remain
      expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
      expect(result & Permission.SEND_MESSAGES).toBe(0n);
    });

    it('applies member role overrides', async () => {
      const everyonePerms = Permission.READ_MESSAGES;
      const everyoneRoleId = 50n;
      const memberRoleId = 60n;

      mockDb.query.servers.findFirst.mockResolvedValue({ id: 100n, ownerId: 999n });
      mockDb.query.serverMembers.findFirst.mockResolvedValue({ serverId: 100n, userId: 1n });
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: everyoneRoleId,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });

      // First call to where (in computeServerPermissions): no additional roles
      // Second call to where (in computeChannelPermissions): member has roleId 60
      mockDb.where
        .mockResolvedValueOnce([]) // computeServerPermissions memberRoleRows
        .mockResolvedValueOnce([{ roleId: memberRoleId }]); // computeChannelPermissions memberRoleRows

      // Channel overrides: allow SEND_MESSAGES for role 60
      mockDb.query.channelPermissionOverrides.findMany.mockResolvedValue([
        {
          targetType: 'role',
          targetId: memberRoleId,
          allow: Permission.SEND_MESSAGES,
          deny: 0n,
        },
      ]);

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      // Should have READ_MESSAGES from @everyone + SEND_MESSAGES from role override
      expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
      expect(result & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
    });

    it('applies member-specific override', async () => {
      const everyonePerms = Permission.READ_MESSAGES | Permission.SEND_MESSAGES;
      const everyoneRoleId = 50n;
      const userId = 1n;

      mockDb.query.servers.findFirst.mockResolvedValue({ id: 100n, ownerId: 999n });
      mockDb.query.serverMembers.findFirst.mockResolvedValue({ serverId: 100n, userId });
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: everyoneRoleId,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });
      mockDb.where.mockResolvedValue([]);

      // Member-specific override: deny SEND_MESSAGES, allow MANAGE_MESSAGES
      mockDb.query.channelPermissionOverrides.findMany.mockResolvedValue([
        {
          targetType: 'member',
          targetId: userId,
          allow: Permission.MANAGE_MESSAGES,
          deny: Permission.SEND_MESSAGES,
        },
      ]);

      const result = await computeChannelPermissions(mockDb, '100', '200', '1');
      expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
      expect(result & Permission.SEND_MESSAGES).toBe(0n);
      expect(result & Permission.MANAGE_MESSAGES).toBe(Permission.MANAGE_MESSAGES);
    });
  });

  describe('requirePermission', () => {
    it('passes when user has the required permission', async () => {
      // Owner has ALL_PERMISSIONS
      mockDb.query.servers.findFirst.mockResolvedValue({ id: 100n, ownerId: 1n });

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

      mockDb.query.servers.findFirst.mockResolvedValue({ id: 100n, ownerId: 999n });
      mockDb.query.serverMembers.findFirst.mockResolvedValue({ serverId: 100n, userId: 1n });
      mockDb.query.roles.findFirst.mockResolvedValue({
        id: 50n,
        serverId: 100n,
        isDefault: true,
        permissions: everyonePerms,
      });
      mockDb.where.mockResolvedValue([]);

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

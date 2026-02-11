import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../usePermissions.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { useMemberStore } from '../../stores/member.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { Permission, permissionToString } from '@harmonium/shared';

// Mock localStorage to prevent Node.js 22 built-in conflict with jsdom
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key);
  }),
  clear: vi.fn(() => {
    storage.clear();
  }),
  get length() {
    return storage.size;
  },
  key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
});

describe('usePermissions', () => {
  beforeEach(() => {
    storage.clear();
    // Reset stores to initial state
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
    });
    useServerStore.setState({
      servers: new Map(),
      currentServerId: null,
    });
    useMemberStore.setState({
      members: new Map(),
    });
  });

  it('returns 0n when no serverId', () => {
    useAuthStore.setState({
      user: { id: 'user-1', username: 'test', discriminator: '0001', avatarUrl: null, aboutMe: null, status: 'online' as const, customStatus: null, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    });

    const { result } = renderHook(() => usePermissions(null));
    expect(result.current.permissions).toBe(0n);
  });

  it('returns 0n when no userId (not logged in)', () => {
    useAuthStore.setState({ user: null });

    const { result } = renderHook(() => usePermissions('server-1'));
    expect(result.current.permissions).toBe(0n);
  });

  it('owner gets all permissions (~0n)', () => {
    const userId = 'user-1';
    const serverId = 'server-1';

    useAuthStore.setState({
      user: { id: userId, username: 'owner', discriminator: '0001', avatarUrl: null, aboutMe: null, status: 'online' as const, customStatus: null, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    });
    const servers = new Map();
    servers.set(serverId, {
      id: serverId,
      name: 'Test Server',
      iconUrl: null,
      ownerId: userId,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });
    useServerStore.setState({ servers });

    const { result } = renderHook(() => usePermissions(serverId));
    // ~0n is all bits set (BigInt bitwise NOT of 0n = -1n)
    expect(result.current.permissions).toBe(~0n);
  });

  it('computes permissions from default roles', () => {
    const userId = 'user-1';
    const serverId = 'server-1';

    useAuthStore.setState({
      user: { id: userId, username: 'member', discriminator: '0001', avatarUrl: null, aboutMe: null, status: 'online' as const, customStatus: null, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    });

    // Server where user is NOT the owner
    const servers = new Map();
    servers.set(serverId, {
      id: serverId,
      name: 'Test Server',
      iconUrl: null,
      ownerId: 'other-user',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });
    useServerStore.setState({ servers });

    // User is a member
    const members = new Map();
    members.set(serverId, [
      { serverId, userId, nickname: null, joinedAt: '2024-01-01', roles: [] },
    ]);
    useMemberStore.setState({ members });

    const defaultPerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const roles = [
      { id: 'role-default', permissions: permissionToString(defaultPerms), isDefault: true },
    ];

    const { result } = renderHook(() => usePermissions(serverId, roles));
    expect(result.current.permissions).toBe(defaultPerms);
  });

  it('computes permissions from member assigned roles', () => {
    const userId = 'user-1';
    const serverId = 'server-1';

    useAuthStore.setState({
      user: { id: userId, username: 'member', discriminator: '0001', avatarUrl: null, aboutMe: null, status: 'online' as const, customStatus: null, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    });

    const servers = new Map();
    servers.set(serverId, {
      id: serverId,
      name: 'Test Server',
      iconUrl: null,
      ownerId: 'other-user',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });
    useServerStore.setState({ servers });

    // Member has role-mod assigned
    const members = new Map();
    members.set(serverId, [
      { serverId, userId, nickname: null, joinedAt: '2024-01-01', roles: ['role-mod'] },
    ]);
    useMemberStore.setState({ members });

    const defaultPerms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const modPerms = Permission.MANAGE_MESSAGES | Permission.KICK_MEMBERS;
    const roles = [
      { id: 'role-default', permissions: permissionToString(defaultPerms), isDefault: true },
      { id: 'role-mod', permissions: permissionToString(modPerms), isDefault: false },
      { id: 'role-admin', permissions: permissionToString(Permission.ADMINISTRATOR), isDefault: false },
    ];

    const { result } = renderHook(() => usePermissions(serverId, roles));
    // Should have default + mod permissions, but NOT admin (not assigned)
    const expected = defaultPerms | modPerms;
    expect(result.current.permissions).toBe(expected);
  });

  it('hasPermission helper works correctly', () => {
    const userId = 'user-1';
    const serverId = 'server-1';

    useAuthStore.setState({
      user: { id: userId, username: 'member', discriminator: '0001', avatarUrl: null, aboutMe: null, status: 'online' as const, customStatus: null, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    });

    const servers = new Map();
    servers.set(serverId, {
      id: serverId,
      name: 'Test Server',
      iconUrl: null,
      ownerId: 'other-user',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });
    useServerStore.setState({ servers });

    const members = new Map();
    members.set(serverId, [
      { serverId, userId, nickname: null, joinedAt: '2024-01-01', roles: [] },
    ]);
    useMemberStore.setState({ members });

    const perms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const roles = [
      { id: 'role-default', permissions: permissionToString(perms), isDefault: true },
    ];

    const { result } = renderHook(() => usePermissions(serverId, roles));

    expect(result.current.hasPermission(Permission.SEND_MESSAGES)).toBe(true);
    expect(result.current.hasPermission(Permission.READ_MESSAGES)).toBe(true);
    expect(result.current.hasPermission(Permission.ADMINISTRATOR)).toBe(false);
    expect(result.current.hasPermission(Permission.MANAGE_SERVER)).toBe(false);
  });
});

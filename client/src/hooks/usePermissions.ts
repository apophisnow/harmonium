import { useMemo } from 'react';
import {
  hasPermission as checkPermission,
  stringToPermission,
  type PermissionFlag,
} from '@harmonium/shared';
import { useAuthStore } from '../stores/auth.store.js';
import { useMemberStore } from '../stores/member.store.js';
import { useServerStore } from '../stores/server.store.js';

// A simplified role store inline; we keep roles fetched via API in a module-level cache.
// In production you'd use a proper store; here we accept roles as a param or from member data.

export function usePermissions(
  serverId: string | null,
  roles: Array<{ id: string; permissions: string; isDefault: boolean }> = [],
) {
  const userId = useAuthStore((s) => s.user?.id);
  const server = useServerStore((s) =>
    serverId ? s.servers.get(serverId) : undefined,
  );
  const members = useMemberStore((s) =>
    serverId ? s.members.get(serverId) : undefined,
  );

  const permissions = useMemo(() => {
    if (!userId || !serverId) return 0n;

    // Server owner has all permissions
    if (server?.ownerId === userId) {
      return ~0n; // all bits set
    }

    const member = members?.find((m) => m.userId === userId);
    if (!member) return 0n;

    const memberRoleIds = new Set(member.roles ?? []);
    let perms = 0n;

    for (const role of roles) {
      if (role.isDefault || memberRoleIds.has(role.id)) {
        perms |= stringToPermission(role.permissions);
      }
    }

    return perms;
  }, [userId, serverId, server, members, roles]);

  const hasPermissionFn = useMemo(() => {
    return (flag: PermissionFlag) => checkPermission(permissions, flag);
  }, [permissions]);

  return { hasPermission: hasPermissionFn, permissions };
}

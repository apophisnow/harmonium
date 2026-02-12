import { useState, useEffect, useCallback } from 'react';
import { useServerStore } from '../../stores/server.store.js';
import { useMemberStore } from '../../stores/member.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { UserAvatar } from '../user/UserAvatar.js';
import type { ServerMember, UserStatus, Role } from '@harmonium/shared';
import { getRoles } from '../../api/roles.js';
import { MemberUserCard } from '../member/MemberUserCard.js';

const EMPTY_MEMBERS: ServerMember[] = [];

export function MemberSidebar() {
  const currentServerId = useServerStore((s) => s.currentServerId);
  const server = useServerStore((s) =>
    currentServerId ? s.servers.get(currentServerId) : undefined,
  );
  const members = useMemberStore((s) =>
    currentServerId ? (s.members.get(currentServerId) ?? EMPTY_MEMBERS) : EMPTY_MEMBERS,
  );
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const presences = usePresenceStore((s) => s.presences);

  const [roles, setRoles] = useState<Role[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    member: ServerMember;
    position: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (currentServerId) {
      fetchMembers(currentServerId);
    }
  }, [currentServerId, fetchMembers]);

  // Fetch roles when server changes
  useEffect(() => {
    if (currentServerId) {
      getRoles(currentServerId).then(setRoles).catch(() => {});
    }
  }, [currentServerId]);

  // Listen for role updates via custom events from WS
  useEffect(() => {
    const handleRoleUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as { serverId: string; role: Role };
      if (detail.serverId === currentServerId) {
        setRoles((prev) => prev.map((r) => (r.id === detail.role.id ? detail.role : r)));
      }
    };
    window.addEventListener('ws:role_update', handleRoleUpdate);
    return () => window.removeEventListener('ws:role_update', handleRoleUpdate);
  }, [currentServerId]);

  // Separate online and offline members
  const onlineMembers = members.filter((m) => {
    const status = presences.get(m.userId);
    return status && status !== 'offline';
  });

  const offlineMembers = members.filter((m) => {
    const status = presences.get(m.userId);
    return !status || status === 'offline';
  });

  const handleMemberClick = useCallback((member: ServerMember, event: React.MouseEvent) => {
    setContextMenu({
      member,
      position: { x: event.clientX, y: event.clientY },
    });
  }, []);

  return (
    <div className="hidden h-full w-60 flex-col bg-th-bg-secondary overflow-y-auto md:flex">
      {/* Online members */}
      {onlineMembers.length > 0 && (
        <div className="pt-6 px-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-th-text-secondary">
            Online -- {onlineMembers.length}
          </h3>
          {onlineMembers.map((member) => (
            <MemberItem
              key={member.userId}
              member={member}
              username={member.user?.username ?? member.nickname ?? 'Unknown'}
              avatarUrl={member.user?.avatarUrl}
              status={presences.get(member.userId) ?? 'online'}
              serverOwnerId={server?.ownerId}
              roles={roles}
              onClick={handleMemberClick}
            />
          ))}
        </div>
      )}

      {/* Offline members */}
      {offlineMembers.length > 0 && (
        <div className="pt-4 px-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-th-text-secondary">
            Offline -- {offlineMembers.length}
          </h3>
          {offlineMembers.map((member) => (
            <MemberItem
              key={member.userId}
              member={member}
              username={member.user?.username ?? member.nickname ?? 'Unknown'}
              avatarUrl={member.user?.avatarUrl}
              status="offline"
              isOffline
              serverOwnerId={server?.ownerId}
              roles={roles}
              onClick={handleMemberClick}
            />
          ))}
        </div>
      )}

      {members.length === 0 && (
        <div className="flex items-center justify-center p-4">
          <p className="text-sm text-th-text-secondary">No members</p>
        </div>
      )}

      {contextMenu && (
        <MemberUserCard
          member={contextMenu.member}
          roles={roles}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function MemberItem({
  member,
  username,
  avatarUrl,
  status,
  isOffline = false,
  serverOwnerId,
  roles,
  onClick,
}: {
  member: ServerMember;
  username: string;
  avatarUrl?: string | null;
  status: UserStatus;
  isOffline?: boolean;
  serverOwnerId?: string;
  roles?: Role[];
  onClick?: (member: ServerMember, event: React.MouseEvent) => void;
}) {
  const isOwner = serverOwnerId === member.userId;
  const memberRoleIds = new Set(member.roles ?? []);
  const memberRoles = (roles ?? []).filter((r) => !r.isDefault && memberRoleIds.has(r.id));

  return (
    <div
      className={`flex items-center gap-3 rounded px-2 py-1.5 hover:bg-th-bg-primary cursor-pointer transition-colors ${
        isOffline ? 'opacity-40' : ''
      }`}
      onClick={(e) => onClick?.(member, e)}
    >
      <UserAvatar
        username={username}
        avatarUrl={avatarUrl}
        status={status}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-medium text-th-text-secondary">
            {username}
          </span>
          {isOwner && (
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-th-yellow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 19h20l-2-8-5 4-3-6-3 6-5-4-2 8z" />
            </svg>
          )}
        </div>
        {memberRoles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {memberRoles.map((role) => (
              <span
                key={role.id}
                className="inline-flex items-center gap-0.5 rounded-full bg-th-bg-card px-1.5 py-0 text-[10px] text-th-text-secondary"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: role.color
                      ? `#${role.color.toString(16).padStart(6, '0')}`
                      : '#99aab5',
                  }}
                />
                {role.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

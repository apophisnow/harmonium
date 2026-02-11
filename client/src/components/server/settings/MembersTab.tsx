import { useState, useEffect } from 'react';
import type { ServerMember, Role } from '@harmonium/shared';
import { Permission } from '@harmonium/shared';
import { useServerStore } from '../../../stores/server.store.js';
import { useMemberStore } from '../../../stores/member.store.js';
import { usePresenceStore } from '../../../stores/presence.store.js';
import { useAuthStore } from '../../../stores/auth.store.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { UserAvatar } from '../../user/UserAvatar.js';
import { assignRole, removeRole } from '../../../api/roles.js';
import { kickMember } from '../../../api/servers.js';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

const EMPTY_MEMBERS: ServerMember[] = [];

interface MembersTabProps {
  roles: Role[];
  currentServerId: string | null;
  isOwner: boolean;
}

export function MembersTab({ roles, currentServerId, isOwner }: MembersTabProps) {
  const [search, setSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [confirmKickUserId, setConfirmKickUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const members = useMemberStore((s) =>
    currentServerId ? (s.members.get(currentServerId) ?? EMPTY_MEMBERS) : EMPTY_MEMBERS,
  );
  const fetchMembers = useMemberStore((s) => s.fetchMembers);
  const presences = usePresenceStore((s) => s.presences);
  const currentUser = useAuthStore((s) => s.user);
  const server = useServerStore((s) =>
    currentServerId ? s.servers.get(currentServerId) : undefined,
  );

  const { hasPermission } = usePermissions(currentServerId, roles);
  const canManageRoles = isOwner || hasPermission(Permission.MANAGE_ROLES);
  const canKick = isOwner || hasPermission(Permission.KICK_MEMBERS);

  useEffect(() => {
    if (currentServerId) {
      fetchMembers(currentServerId);
    }
  }, [currentServerId, fetchMembers]);

  const nonDefaultRoles = roles.filter((r) => !r.isDefault);

  const filtered = search.trim()
    ? members.filter((m) => {
        const name = m.user?.username ?? m.nickname ?? '';
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : members;

  // Sort: online first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    const aOnline = presences.get(a.userId) !== 'offline' && presences.has(a.userId);
    const bOnline = presences.get(b.userId) !== 'offline' && presences.has(b.userId);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    const aName = a.user?.username ?? '';
    const bName = b.user?.username ?? '';
    return aName.localeCompare(bName);
  });

  const handleToggleRole = async (userId: string, roleId: string, hasRole: boolean) => {
    if (!currentServerId) return;
    setTogglingRoleId(roleId);
    setError('');
    try {
      if (hasRole) {
        await removeRole(currentServerId, roleId, userId);
      } else {
        await assignRole(currentServerId, roleId, userId);
      }
    } catch {
      setError('Failed to update role.');
    } finally {
      setTogglingRoleId(null);
    }
  };

  const handleKick = async (userId: string) => {
    if (!currentServerId) return;
    setKickingUserId(userId);
    setError('');
    try {
      await kickMember(currentServerId, userId);
      setConfirmKickUserId(null);
    } catch {
      setError('Failed to kick member.');
    } finally {
      setKickingUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Members</h2>
        <span className="text-sm text-[#96989d]">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members"
        className="w-full rounded bg-[#202225] px-3 py-2 text-sm text-[#dcddde] placeholder-[#72767d] outline-none focus:ring-2 focus:ring-[#5865f2]"
      />

      {error && <p className="text-sm text-[#ed4245]">{error}</p>}

      {/* Member list */}
      <div className="space-y-1">
        {sorted.map((member) => {
          const username = member.user?.username ?? member.nickname ?? 'Unknown';
          const status = presences.get(member.userId) ?? 'offline';
          const isOffline = !presences.has(member.userId) || status === 'offline';
          const isMemberOwner = server?.ownerId === member.userId;
          const isSelf = currentUser?.id === member.userId;
          const memberRoleIds = new Set(member.roles ?? []);
          const memberRoles = nonDefaultRoles.filter((r) => memberRoleIds.has(r.id));
          const isExpanded = expandedUserId === member.userId;

          return (
            <div key={member.userId} className="rounded-lg bg-[#2f3136]">
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#36393f] cursor-pointer ${
                  isOffline ? 'opacity-60' : ''
                }`}
                onClick={() => setExpandedUserId(isExpanded ? null : member.userId)}
              >
                <UserAvatar
                  username={username}
                  avatarUrl={member.user?.avatarUrl}
                  status={status}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-[#dcddde]">
                      {username}
                    </span>
                    {isMemberOwner && (
                      <svg className="h-3.5 w-3.5 flex-shrink-0 text-[#faa61a]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 19h20l-2-8-5 4-3-6-3 6-5-4-2 8z" />
                      </svg>
                    )}
                    {member.user?.discriminator && (
                      <span className="text-xs text-[#72767d]">#{member.user.discriminator}</span>
                    )}
                  </div>
                  {memberRoles.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {memberRoles.map((role) => (
                        <span
                          key={role.id}
                          className="inline-flex items-center gap-0.5 rounded-full bg-[#292b2f] px-1.5 py-0 text-[10px] text-[#96989d]"
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

              {/* Expanded: role management + kick */}
              {isExpanded && (
                <div className="border-t border-[#42444a] px-3 py-2 space-y-2">
                  {canManageRoles && !isSelf && (
                    <div>
                      <h4 className="mb-1 text-xs font-semibold uppercase text-[#96989d]">Roles</h4>
                      {nonDefaultRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {nonDefaultRoles.map((role) => {
                            const has = memberRoleIds.has(role.id);
                            return (
                              <button
                                key={role.id}
                                onClick={() => handleToggleRole(member.userId, role.id, has)}
                                disabled={togglingRoleId === role.id}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                                  has
                                    ? 'border-[#5865f2] bg-[#5865f2]/20 text-[#dcddde]'
                                    : 'border-[#42444a] text-[#96989d] hover:border-[#5865f2]'
                                }`}
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
                                {togglingRoleId === role.id && <LoadingSpinner size={10} />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#72767d]">No roles created yet. Create roles in the Roles tab.</p>
                      )}
                    </div>
                  )}

                  {canKick && !isMemberOwner && !isSelf && (
                    <div>
                      {confirmKickUserId === member.userId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#ed4245]">Kick {username}?</span>
                          <button
                            onClick={() => setConfirmKickUserId(null)}
                            className="text-xs text-[#96989d] hover:underline"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleKick(member.userId)}
                            disabled={kickingUserId === member.userId}
                            className="flex items-center gap-1 rounded bg-[#ed4245] px-2 py-0.5 text-xs font-medium text-white hover:bg-[#c03537] disabled:opacity-50"
                          >
                            {kickingUserId === member.userId && <LoadingSpinner size={10} />}
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmKickUserId(member.userId)}
                          className="text-xs text-[#ed4245] hover:underline"
                        >
                          Kick Member
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-lg bg-[#2f3136]">
            <p className="text-sm text-[#72767d]">
              {search ? 'No members match your search' : 'No members'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import type { ServerMember, Role } from '@harmonium/shared';
import { Permission } from '@harmonium/shared';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useServerStore } from '../../stores/server.store.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { assignRole, removeRole } from '../../api/roles.js';
import { kickMember } from '../../api/servers.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

interface MemberContextMenuProps {
  member: ServerMember;
  roles: Role[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function MemberContextMenu({ member, roles, position, onClose }: MemberContextMenuProps) {
  const currentServerId = useServerStore((s) => s.currentServerId);
  const server = useServerStore((s) =>
    currentServerId ? s.servers.get(currentServerId) : undefined,
  );
  const currentUser = useAuthStore((s) => s.user);
  const { hasPermission } = usePermissions(currentServerId, roles);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isKicking, setIsKicking] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isOwner = server?.ownerId === currentUser?.id;
  const isTargetOwner = server?.ownerId === member.userId;
  const isSelf = currentUser?.id === member.userId;

  const canManageRoles = isOwner || hasPermission(Permission.MANAGE_ROLES);
  const canKick = (isOwner || hasPermission(Permission.KICK_MEMBERS)) && !isTargetOwner && !isSelf;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let { x, y } = position;
      if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
      if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
      if (x < 0) x = 8;
      if (y < 0) y = 8;
      setAdjustedPosition({ x, y });
    }
  }, [position]);

  const memberRoleIds = new Set(member.roles ?? []);
  const nonDefaultRoles = roles.filter((r) => !r.isDefault);

  const handleToggleRole = async (roleId: string) => {
    if (!currentServerId) return;
    setTogglingRoleId(roleId);
    setError('');
    try {
      if (memberRoleIds.has(roleId)) {
        await removeRole(currentServerId, roleId, member.userId);
      } else {
        await assignRole(currentServerId, roleId, member.userId);
      }
      // The WS MEMBER_UPDATE event will update the store
    } catch {
      setError('Failed to update role.');
    } finally {
      setTogglingRoleId(null);
    }
  };

  const handleKick = async () => {
    if (!currentServerId) return;
    setIsKicking(true);
    setError('');
    try {
      await kickMember(currentServerId, member.userId);
      onClose();
    } catch {
      setError('Failed to kick member.');
      setIsKicking(false);
    }
  };

  const username = member.user?.username ?? 'Unknown';

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 rounded-lg bg-[#18191c] shadow-xl border border-[#2f3136]"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#2f3136] px-3 py-3">
        <UserAvatar
          username={username}
          avatarUrl={member.user?.avatarUrl}
          status={member.user?.status ?? 'offline'}
          size={40}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold text-white">{username}</span>
            {isTargetOwner && (
              <svg className="h-4 w-4 flex-shrink-0 text-[#faa61a]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 19h20l-2-8-5 4-3-6-3 6-5-4-2 8z" />
              </svg>
            )}
          </div>
          {member.user?.discriminator && (
            <span className="text-xs text-[#96989d]">#{member.user.discriminator}</span>
          )}
        </div>
      </div>

      {/* Roles section */}
      {canManageRoles && !isSelf && nonDefaultRoles.length > 0 && (
        <div className="border-b border-[#2f3136] px-3 py-2">
          <h4 className="mb-1.5 text-xs font-semibold uppercase text-[#96989d]">Roles</h4>
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {nonDefaultRoles.map((role) => (
              <label
                key={role.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-[#2f3136] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={memberRoleIds.has(role.id)}
                  onChange={() => handleToggleRole(role.id)}
                  disabled={togglingRoleId === role.id}
                  className="h-3.5 w-3.5 accent-[#5865f2]"
                />
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{
                    backgroundColor: role.color
                      ? `#${role.color.toString(16).padStart(6, '0')}`
                      : '#99aab5',
                  }}
                />
                <span className="truncate text-sm text-[#dcddde]">{role.name}</span>
                {togglingRoleId === role.id && <LoadingSpinner size={12} />}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Kick button */}
      {canKick && (
        <div className="px-3 py-2">
          {!showKickConfirm ? (
            <button
              onClick={() => setShowKickConfirm(true)}
              className="w-full rounded px-2 py-1.5 text-left text-sm text-[#ed4245] hover:bg-[#ed4245]/10 transition-colors"
            >
              Kick {username}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[#ed4245]">
                Kick <span className="font-semibold">{username}</span> from the server?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowKickConfirm(false)}
                  disabled={isKicking}
                  className="flex-1 rounded px-2 py-1 text-xs text-[#dcddde] hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleKick}
                  disabled={isKicking}
                  className="flex flex-1 items-center justify-center gap-1 rounded bg-[#ed4245] px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-[#c03537] disabled:opacity-50"
                >
                  {isKicking && <LoadingSpinner size={12} />}
                  Kick
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="px-3 pb-2 text-xs text-[#ed4245]">{error}</p>
      )}
    </div>
  );
}

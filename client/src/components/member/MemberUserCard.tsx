import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ServerMember, Role } from '@harmonium/shared';
import { Permission } from '@harmonium/shared';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useServerStore } from '../../stores/server.store.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { UserAvatar } from '../user/UserAvatar.js';
import { assignRole, removeRole } from '../../api/roles.js';
import { kickMember } from '../../api/servers.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

interface MemberUserCardProps {
  member: ServerMember;
  roles: Role[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function MemberUserCard({ member, roles, position, onClose }: MemberUserCardProps) {
  const currentServerId = useServerStore((s) => s.currentServerId);
  const server = useServerStore((s) =>
    currentServerId ? s.servers.get(currentServerId) : undefined,
  );
  const currentUser = useAuthStore((s) => s.user);
  const presences = usePresenceStore((s) => s.presences);
  const { hasPermission } = usePermissions(currentServerId, roles);
  const cardRef = useRef<HTMLDivElement>(null);

  const [isKicking, setIsKicking] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isOwner = server?.ownerId === currentUser?.id;
  const isTargetOwner = server?.ownerId === member.userId;
  const isSelf = currentUser?.id === member.userId;

  const canManageRoles = isOwner || hasPermission(Permission.MANAGE_ROLES);
  const canKick = (isOwner || hasPermission(Permission.KICK_MEMBERS)) && !isTargetOwner && !isSelf;

  const username = member.user?.username ?? member.nickname ?? 'Unknown';
  const discriminator = member.user?.discriminator;
  const aboutMe = member.user?.aboutMe;
  const customStatus = member.user?.customStatus;
  const status = presences.get(member.userId) ?? member.user?.status ?? 'offline';

  const memberRoleIds = new Set(member.roles ?? []);
  const nonDefaultRoles = roles.filter((r) => !r.isDefault);
  const memberRoles = nonDefaultRoles.filter((r) => memberRoleIds.has(r.id));

  // Get banner color from highest-position role
  const sortedMemberRoles = [...memberRoles].sort((a, b) => b.position - a.position);
  const topRoleColor = sortedMemberRoles.find((r) => r.color)?.color;
  const bannerColor = topRoleColor
    ? `#${topRoleColor.toString(16).padStart(6, '0')}`
    : '#5865f2';

  // Close on click outside / ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
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

  // Adjust position to stay within viewport, positioned to the left of click
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      let x = position.x - 310; // Position to the left
      let y = position.y - 40; // Slightly above click point

      // Keep within viewport
      if (x < 8) x = 8;
      if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
      if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
      if (y < 8) y = 8;

      setAdjustedPosition({ x, y });
    }
  }, [position]);

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

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const roleColorHex = (color: number | null | undefined) =>
    color ? `#${color.toString(16).padStart(6, '0')}` : '#99aab5';

  return createPortal(
    <div
      ref={cardRef}
      className="fixed z-50 w-[300px] overflow-hidden rounded-lg bg-[#292b2f] shadow-xl"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {/* Banner */}
      <div className="h-[60px]" style={{ backgroundColor: bannerColor }} />

      {/* Avatar — overlapping the banner */}
      <div className="relative px-4">
        <div className="-mt-10 mb-2 w-fit rounded-full border-[5px] border-[#292b2f]">
          <UserAvatar
            username={username}
            avatarUrl={member.user?.avatarUrl}
            status={status}
            size={80}
          />
        </div>
      </div>

      {/* Username / Discriminator / Custom Status */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-white">{username}</span>
          {isTargetOwner && (
            <svg className="h-5 w-5 flex-shrink-0 text-[#faa61a]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 19h20l-2-8-5 4-3-6-3 6-5-4-2 8z" />
            </svg>
          )}
        </div>
        {discriminator && (
          <span className="text-sm text-[#b9bbbe]">{username}#{discriminator}</span>
        )}
        {customStatus && (
          <p className="mt-1 text-sm text-[#b9bbbe]">{customStatus}</p>
        )}
      </div>

      <div className="mx-4 border-t border-[#3f4147]" />

      {/* About Me */}
      {aboutMe && (
        <div className="px-4 py-3">
          <h4 className="mb-1 text-xs font-bold uppercase text-white">About Me</h4>
          <p className="whitespace-pre-wrap text-sm text-[#b9bbbe]">{aboutMe}</p>
        </div>
      )}

      {/* Member Since */}
      <div className="px-4 py-3">
        <h4 className="mb-1 text-xs font-bold uppercase text-white">Member Since</h4>
        <p className="text-sm text-[#b9bbbe]">{formatDate(member.joinedAt)}</p>
      </div>

      {/* Roles */}
      {(memberRoles.length > 0 || (canManageRoles && !isSelf)) && (
        <div className="px-4 pb-3">
          <h4 className="mb-1.5 text-xs font-bold uppercase text-white">Roles</h4>

          {/* Role pills */}
          {memberRoles.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {memberRoles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 rounded bg-[#202225] px-2 py-0.5 text-xs text-[#dcddde]"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: roleColorHex(role.color) }}
                  />
                  {role.name}
                </span>
              ))}
            </div>
          )}

          {/* Role checkboxes shown directly for role managers */}
          {canManageRoles && !isSelf && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded bg-[#202225] p-2">
              {nonDefaultRoles.length === 0 ? (
                <p className="text-center text-xs text-[#72767d]">No roles created yet</p>
              ) : (
                nonDefaultRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 rounded px-2 py-1 hover:bg-[#36393f] cursor-pointer"
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
                      style={{ backgroundColor: roleColorHex(role.color) }}
                    />
                    <span className="truncate text-sm text-[#dcddde]">{role.name}</span>
                    {togglingRoleId === role.id && <LoadingSpinner size={12} />}
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Kick button */}
      {canKick && (
        <>
          <div className="mx-4 border-t border-[#3f4147]" />
          <div className="px-4 py-3">
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
        </>
      )}

      {error && (
        <p className="px-4 pb-3 text-xs text-[#ed4245]">{error}</p>
      )}
    </div>,
    document.body,
  );
}

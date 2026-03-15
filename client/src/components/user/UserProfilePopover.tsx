import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { PublicUser, ServerMember, Role } from '@harmonium/shared';
import { Permission } from '@harmonium/shared';
import { useAuthStore } from '../../stores/auth.store.js';
import { usePresenceStore } from '../../stores/presence.store.js';
import { useRelationshipStore } from '../../stores/relationship.store.js';
import { useDmStore } from '../../stores/dm.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { assignRole, removeRole } from '../../api/roles.js';
import { kickMember } from '../../api/servers.js';
import { banMember } from '../../api/bans.js';
import { UserAvatar } from './UserAvatar.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

interface UserProfilePopoverProps {
  user: PublicUser;
  /** If provided, shows server-specific info (roles, kick, ban) */
  member?: ServerMember;
  roles?: Role[];
  serverId?: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function UserProfilePopover({
  user,
  member,
  roles = [],
  serverId,
  position,
  onClose,
}: UserProfilePopoverProps) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const presences = usePresenceStore((s) => s.presences);
  const relationships = useRelationshipStore((s) => s.relationships);
  const sendFriendRequest = useRelationshipStore((s) => s.sendFriendRequest);
  const acceptFriendRequest = useRelationshipStore((s) => s.acceptFriendRequest);
  const removeFriend = useRelationshipStore((s) => s.removeFriend);
  const blockUser = useRelationshipStore((s) => s.blockUser);
  const unblockUser = useRelationshipStore((s) => s.unblockUser);
  const openDm = useDmStore((s) => s.openDm);

  const server = useServerStore((s) =>
    serverId ? s.servers.get(serverId) : undefined,
  );
  const { hasPermission } = usePermissions(serverId ?? null, roles);

  const [isActioning, setIsActioning] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });

  const isSelf = currentUser?.id === user.id;
  const relationship = relationships.get(user.id);
  const status = presences.get(user.id) ?? user.status ?? 'offline';

  // Server-specific
  const isOwner = server?.ownerId === currentUser?.id;
  const isTargetOwner = server?.ownerId === user.id;
  const canManageRoles = serverId && (isOwner || hasPermission(Permission.MANAGE_ROLES));
  const canKick = serverId && (isOwner || hasPermission(Permission.KICK_MEMBERS)) && !isTargetOwner && !isSelf;
  const canBan = serverId && (isOwner || hasPermission(Permission.BAN_MEMBERS)) && !isTargetOwner && !isSelf;

  const memberRoleIds = new Set(member?.roles ?? []);
  const nonDefaultRoles = roles.filter((r) => !r.isDefault);
  const memberRoles = nonDefaultRoles.filter((r) => memberRoleIds.has(r.id));

  // Banner color from highest role
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

  // Position adjustment
  useEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      let x = position.x - 310;
      let y = position.y - 40;
      if (x < 8) x = position.x + 12;
      if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
      if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
      if (y < 8) y = 8;
      setAdjustedPosition({ x, y });
    }
  }, [position]);

  const handleMessage = useCallback(async () => {
    setIsActioning(true);
    setActionError('');
    try {
      const channel = await openDm(user.id);
      onClose();
      navigate(`/channels/@me/${channel.id}`);
    } catch {
      setActionError('Failed to open DM.');
    } finally {
      setIsActioning(false);
    }
  }, [user.id, openDm, onClose, navigate]);

  const handleFriendAction = useCallback(async () => {
    setIsActioning(true);
    setActionError('');
    try {
      if (!relationship) {
        await sendFriendRequest(user.username, user.discriminator);
      } else if (relationship.type === 'pending_incoming') {
        await acceptFriendRequest(user.id);
      } else if (relationship.type === 'friend') {
        await removeFriend(user.id);
      }
    } catch {
      setActionError('Action failed.');
    } finally {
      setIsActioning(false);
    }
  }, [relationship, user, sendFriendRequest, acceptFriendRequest, removeFriend]);

  const handleBlockToggle = useCallback(async () => {
    setIsActioning(true);
    setActionError('');
    try {
      if (relationship?.type === 'blocked') {
        await unblockUser(user.id);
      } else {
        await blockUser(user.id);
      }
    } catch {
      setActionError('Action failed.');
    } finally {
      setIsActioning(false);
    }
  }, [relationship, user.id, blockUser, unblockUser]);

  const handleToggleRole = async (roleId: string) => {
    if (!serverId) return;
    setTogglingRoleId(roleId);
    setActionError('');
    try {
      if (memberRoleIds.has(roleId)) {
        await removeRole(serverId, roleId, user.id);
      } else {
        await assignRole(serverId, roleId, user.id);
      }
    } catch {
      setActionError('Failed to update role.');
    } finally {
      setTogglingRoleId(null);
    }
  };

  const handleKick = async () => {
    if (!serverId) return;
    setIsActioning(true);
    setActionError('');
    try {
      await kickMember(serverId, user.id);
      onClose();
    } catch {
      setActionError('Failed to kick member.');
      setIsActioning(false);
    }
  };

  const handleBan = async () => {
    if (!serverId) return;
    setIsActioning(true);
    setActionError('');
    try {
      await banMember(serverId, user.id);
      onClose();
    } catch {
      setActionError('Failed to ban member.');
      setIsActioning(false);
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

  // Friend button state
  let friendButtonLabel = 'Add Friend';
  let friendButtonStyle = 'bg-th-brand text-white hover:bg-th-brand-hover';
  if (relationship?.type === 'friend') {
    friendButtonLabel = 'Remove Friend';
    friendButtonStyle = 'bg-th-bg-tertiary text-th-text-secondary hover:bg-th-red hover:text-white';
  } else if (relationship?.type === 'pending_outgoing') {
    friendButtonLabel = 'Request Sent';
    friendButtonStyle = 'bg-th-bg-tertiary text-th-text-muted cursor-default';
  } else if (relationship?.type === 'pending_incoming') {
    friendButtonLabel = 'Accept Request';
    friendButtonStyle = 'bg-th-green text-white hover:bg-th-green-hover';
  } else if (relationship?.type === 'blocked') {
    friendButtonLabel = 'Blocked';
    friendButtonStyle = 'bg-th-bg-tertiary text-th-text-muted cursor-default';
  }

  return createPortal(
    <div
      ref={cardRef}
      className="fixed z-50 w-[300px] overflow-hidden rounded-lg bg-th-bg-card shadow-xl"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {/* Banner */}
      <div className="h-[60px]" style={{ backgroundColor: bannerColor }} />

      {/* Avatar */}
      <div className="relative px-4">
        <div className="-mt-10 mb-2 w-fit rounded-full border-[5px] border-th-bg-card">
          <UserAvatar
            username={user.username}
            avatarUrl={user.avatarUrl}
            status={status}
            size={80}
          />
        </div>
      </div>

      {/* Username / Discriminator / Status */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-white">{user.username}</span>
          {isTargetOwner && (
            <svg className="h-5 w-5 flex-shrink-0 text-th-yellow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 19h20l-2-8-5 4-3-6-3 6-5-4-2 8z" />
            </svg>
          )}
        </div>
        <span className="text-sm text-th-text-tertiary">
          {user.username}#{user.discriminator}
        </span>
        {user.customStatus && (
          <p className="mt-1 text-sm text-th-text-tertiary">{user.customStatus}</p>
        )}
      </div>

      {/* Action buttons (not shown for self) */}
      {!isSelf && (
        <div className="mx-4 mb-3 flex gap-2">
          <button
            onClick={handleMessage}
            disabled={isActioning || relationship?.type === 'blocked'}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-th-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50"
          >
            {isActioning ? <LoadingSpinner size={14} /> : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
            )}
            Message
          </button>
          {relationship?.type !== 'blocked' && (
            <button
              onClick={relationship?.type === 'pending_outgoing' ? undefined : handleFriendAction}
              disabled={isActioning || relationship?.type === 'pending_outgoing'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${friendButtonStyle}`}
            >
              {friendButtonLabel}
            </button>
          )}
        </div>
      )}

      <div className="mx-4 border-t border-th-border" />

      {/* About Me */}
      {user.aboutMe && (
        <div className="px-4 py-3">
          <h4 className="mb-1 text-xs font-bold uppercase text-white">About Me</h4>
          <p className="whitespace-pre-wrap text-sm text-th-text-tertiary">{user.aboutMe}</p>
        </div>
      )}

      {/* Member Since (server context) */}
      {member && (
        <div className="px-4 py-3">
          <h4 className="mb-1 text-xs font-bold uppercase text-white">Member Since</h4>
          <p className="text-sm text-th-text-tertiary">{formatDate(member.joinedAt)}</p>
        </div>
      )}

      {/* Harmonium Member Since (always shown if no server context) */}
      {!member && (
        <div className="px-4 py-3">
          <h4 className="mb-1 text-xs font-bold uppercase text-white">Joined Harmonium</h4>
          <p className="text-sm text-th-text-tertiary">{formatDate(user.createdAt)}</p>
        </div>
      )}

      {/* Roles (server context only) */}
      {serverId && (memberRoles.length > 0 || (canManageRoles && !isSelf)) && (
        <div className="px-4 pb-3">
          <h4 className="mb-1.5 text-xs font-bold uppercase text-white">Roles</h4>

          {memberRoles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {memberRoles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 rounded bg-th-bg-tertiary px-2 py-0.5 text-xs text-th-text-primary"
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

          {canManageRoles && !isSelf && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded bg-th-bg-tertiary p-2">
              {nonDefaultRoles.length === 0 ? (
                <p className="text-center text-xs text-th-text-muted">No roles created yet</p>
              ) : (
                nonDefaultRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-th-bg-primary"
                  >
                    <input
                      type="checkbox"
                      checked={memberRoleIds.has(role.id)}
                      onChange={() => handleToggleRole(role.id)}
                      disabled={togglingRoleId === role.id}
                      className="h-3.5 w-3.5 accent-th-brand"
                    />
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: roleColorHex(role.color) }}
                    />
                    <span className="truncate text-sm text-th-text-primary">{role.name}</span>
                    {togglingRoleId === role.id && <LoadingSpinner size={12} />}
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Block */}
      {!isSelf && (
        <>
          <div className="mx-4 border-t border-th-border" />
          <div className="px-4 py-3 space-y-1">
            {/* Kick */}
            {canKick && !showKickConfirm && !showBanConfirm && (
              <button
                onClick={() => setShowKickConfirm(true)}
                className="w-full rounded px-2 py-1.5 text-left text-sm text-th-red transition-colors hover:bg-th-red/10"
              >
                Kick {user.username}
              </button>
            )}
            {showKickConfirm && (
              <div className="space-y-2">
                <p className="text-xs text-th-red">
                  Kick <span className="font-semibold">{user.username}</span> from the server?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowKickConfirm(false)}
                    disabled={isActioning}
                    className="flex-1 rounded px-2 py-1 text-xs text-th-text-primary hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleKick}
                    disabled={isActioning}
                    className="flex flex-1 items-center justify-center gap-1 rounded bg-th-red px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-th-red-hover disabled:opacity-50"
                  >
                    {isActioning && <LoadingSpinner size={12} />}
                    Kick
                  </button>
                </div>
              </div>
            )}

            {/* Ban */}
            {canBan && !showKickConfirm && !showBanConfirm && (
              <button
                onClick={() => setShowBanConfirm(true)}
                className="w-full rounded px-2 py-1.5 text-left text-sm text-th-red transition-colors hover:bg-th-red/10"
              >
                Ban {user.username}
              </button>
            )}
            {showBanConfirm && (
              <div className="space-y-2">
                <p className="text-xs text-th-red">
                  Ban <span className="font-semibold">{user.username}</span> from the server?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBanConfirm(false)}
                    disabled={isActioning}
                    className="flex-1 rounded px-2 py-1 text-xs text-th-text-primary hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBan}
                    disabled={isActioning}
                    className="flex flex-1 items-center justify-center gap-1 rounded bg-th-red px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-th-red-hover disabled:opacity-50"
                  >
                    {isActioning && <LoadingSpinner size={12} />}
                    Ban
                  </button>
                </div>
              </div>
            )}

            {/* Block/Unblock */}
            {!showKickConfirm && !showBanConfirm && (
              <button
                onClick={handleBlockToggle}
                disabled={isActioning}
                className="w-full rounded px-2 py-1.5 text-left text-sm text-th-red transition-colors hover:bg-th-red/10 disabled:opacity-50"
              >
                {relationship?.type === 'blocked' ? 'Unblock' : 'Block'} {user.username}
              </button>
            )}
          </div>
        </>
      )}

      {actionError && (
        <p className="px-4 pb-3 text-xs text-th-red">{actionError}</p>
      )}
    </div>,
    document.body,
  );
}

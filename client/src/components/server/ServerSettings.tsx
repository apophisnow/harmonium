import { useState, useEffect, useCallback } from 'react';
import type { Role, Invite } from '@harmonium/shared';
import { Modal } from '../shared/Modal.js';
import { useServerStore } from '../../stores/server.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useAuthStore } from '../../stores/auth.store.js';
import { deleteServer, updateServer } from '../../api/servers.js';
import { getRoles, createRole, deleteRole, reorderRoles, updateRole } from '../../api/roles.js';
import { createInvite, getServerInvites, deleteInvite } from '../../api/invites.js';
import {
  Permission,
  hasPermission as checkPermission,
  addPermission,
  removePermission,
  permissionToString,
  stringToPermission,
} from '@harmonium/shared';
import { usePermissions } from '../../hooks/usePermissions.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

const PERMISSION_CATEGORIES = [
  {
    name: 'General',
    permissions: [
      { flag: Permission.ADMINISTRATOR, label: 'Administrator', description: 'Full access to all permissions' },
      { flag: Permission.MANAGE_SERVER, label: 'Manage Server', description: 'Edit server name and settings' },
      { flag: Permission.MANAGE_CHANNELS, label: 'Manage Channels', description: 'Create, edit, delete channels' },
      { flag: Permission.MANAGE_ROLES, label: 'Manage Roles', description: 'Create, edit, assign roles' },
    ],
  },
  {
    name: 'Membership',
    permissions: [
      { flag: Permission.KICK_MEMBERS, label: 'Kick Members', description: 'Remove members from server' },
      { flag: Permission.BAN_MEMBERS, label: 'Ban Members', description: 'Permanently ban members' },
      { flag: Permission.CREATE_INVITE, label: 'Create Invite', description: 'Create invite links' },
      { flag: Permission.MENTION_EVERYONE, label: 'Mention Everyone', description: 'Use @everyone mentions' },
    ],
  },
  {
    name: 'Text Channels',
    permissions: [
      { flag: Permission.SEND_MESSAGES, label: 'Send Messages', description: 'Send messages in channels' },
      { flag: Permission.READ_MESSAGES, label: 'Read Messages', description: 'View channel messages' },
      { flag: Permission.MANAGE_MESSAGES, label: 'Manage Messages', description: 'Delete or pin messages' },
      { flag: Permission.ATTACH_FILES, label: 'Attach Files', description: 'Upload files in messages' },
    ],
  },
  {
    name: 'Voice Channels',
    permissions: [
      { flag: Permission.CONNECT, label: 'Connect', description: 'Join voice channels' },
      { flag: Permission.SPEAK, label: 'Speak', description: 'Talk in voice channels' },
      { flag: Permission.STREAM, label: 'Stream', description: 'Share screen in voice' },
    ],
  },
];

export function ServerSettings() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState('');
  const [hasEditedName, setHasEditedName] = useState(false);

  // Role management state
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState('');

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);

  const currentServerId = useServerStore((s) => s.currentServerId);
  const server = useServerStore((s) =>
    currentServerId ? s.servers.get(currentServerId) : undefined,
  );
  const storeUpdateServer = useServerStore((s) => s.updateServer);

  const user = useAuthStore((s) => s.user);

  const isOpen = activeModal === 'serverSettings';
  const isOwner = server && user && server.ownerId === user.id;

  // Invite management state
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingInviteCode, setDeletingInviteCode] = useState<string | null>(null);

  // Role editing state
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleColor, setEditRoleColor] = useState<string>('#99aab5');
  const [editRolePermissions, setEditRolePermissions] = useState(0n);
  const [isSavingRole, setIsSavingRole] = useState(false);

  const { hasPermission } = usePermissions(currentServerId, roles);
  const canManageRoles = isOwner || hasPermission(Permission.MANAGE_ROLES);
  const canManageServer = isOwner || hasPermission(Permission.MANAGE_SERVER);
  const canCreateInvite = isOwner || hasPermission(Permission.CREATE_INVITE);

  // Fetch invites when modal opens
  const fetchInvites = useCallback(async () => {
    if (!currentServerId || !canManageServer) return;
    setIsLoadingInvites(true);
    setInviteError('');
    try {
      const fetched = await getServerInvites(currentServerId);
      setInvites(fetched);
    } catch {
      // May not have permission, that's ok
    } finally {
      setIsLoadingInvites(false);
    }
  }, [currentServerId, canManageServer]);

  // Fetch roles when modal opens
  const fetchRoles = useCallback(async () => {
    if (!currentServerId) return;
    setIsLoadingRoles(true);
    setRoleError('');
    try {
      const fetchedRoles = await getRoles(currentServerId);
      setRoles(fetchedRoles);
    } catch {
      setRoleError('Failed to load roles.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, [currentServerId]);

  useEffect(() => {
    if (isOpen && currentServerId) {
      fetchRoles();
      fetchInvites();
    }
  }, [isOpen, currentServerId, fetchRoles, fetchInvites]);

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

  const handleClose = () => {
    setShowDeleteConfirm(false);
    setError('');
    setEditName('');
    setHasEditedName(false);
    setRoles([]);
    setNewRoleName('');
    setRoleError('');
    setEditingRoleId(null);
    setInvites([]);
    setInviteError('');
    setCopiedCode(null);
    closeModal();
  };

  // Sort roles: highest position first, @everyone always at bottom
  const sortedRoles = [...roles].sort((a, b) => {
    if (a.isDefault) return 1;
    if (b.isDefault) return -1;
    return b.position - a.position;
  });

  const nonDefaultRoles = sortedRoles.filter((r) => !r.isDefault);

  const handleMoveRole = async (roleId: string, direction: 'up' | 'down') => {
    if (!currentServerId) return;

    const roleIndex = nonDefaultRoles.findIndex((r) => r.id === roleId);
    if (roleIndex === -1) return;

    const swapIndex = direction === 'up' ? roleIndex - 1 : roleIndex + 1;
    if (swapIndex < 0 || swapIndex >= nonDefaultRoles.length) return;

    const role = nonDefaultRoles[roleIndex];
    const swapRole = nonDefaultRoles[swapIndex];

    setIsReordering(true);
    setRoleError('');
    try {
      const updatedRoles = await reorderRoles(currentServerId, [
        { id: role.id, position: swapRole.position },
        { id: swapRole.id, position: role.position },
      ]);
      setRoles(updatedRoles);
    } catch {
      setRoleError('Failed to reorder roles.');
    } finally {
      setIsReordering(false);
    }
  };

  const handleCreateRole = async () => {
    if (!currentServerId || !newRoleName.trim()) return;

    setIsCreatingRole(true);
    setRoleError('');
    try {
      await createRole(currentServerId, { name: newRoleName.trim() });
      setNewRoleName('');
      await fetchRoles();
    } catch {
      setRoleError('Failed to create role.');
    } finally {
      setIsCreatingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!currentServerId) return;

    setDeletingRoleId(roleId);
    setRoleError('');
    try {
      await deleteRole(currentServerId, roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (editingRoleId === roleId) setEditingRoleId(null);
    } catch {
      setRoleError('Failed to delete role.');
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setEditRoleName(role.name);
    setEditRoleColor(role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5');
    setEditRolePermissions(stringToPermission(role.permissions));
  };

  const handleCancelEdit = () => {
    setEditingRoleId(null);
  };

  const handleTogglePermission = (flag: bigint) => {
    setEditRolePermissions((prev) =>
      checkPermission(prev, flag) ? removePermission(prev, flag) : addPermission(prev, flag),
    );
  };

  const handleSaveRole = async () => {
    if (!currentServerId || !editingRoleId) return;
    setIsSavingRole(true);
    setRoleError('');
    try {
      const colorInt = parseInt(editRoleColor.slice(1), 16);
      const updated = await updateRole(currentServerId, editingRoleId, {
        name: editRoleName.trim() || undefined,
        color: colorInt,
        permissions: permissionToString(editRolePermissions),
      });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingRoleId(null);
    } catch {
      setRoleError('Failed to save role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleDelete = async () => {
    if (!currentServerId) return;

    setIsDeleting(true);
    setError('');

    try {
      await deleteServer(currentServerId);
      // The WS SERVER_DELETE event will handle cleanup in the store
      handleClose();
    } catch {
      setError('Failed to delete server. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveName = async () => {
    if (!currentServerId || !editName.trim()) return;

    setIsUpdating(true);
    setError('');

    try {
      const updated = await updateServer(currentServerId, {
        name: editName.trim(),
      });
      storeUpdateServer(updated);
      setHasEditedName(false);
    } catch {
      setError('Failed to update server name. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!currentServerId) return;
    setIsCreatingInvite(true);
    setInviteError('');
    try {
      const invite = await createInvite(currentServerId, '');
      setInvites((prev) => [invite, ...prev]);
      handleCopyInvite(invite.code);
    } catch {
      setInviteError('Failed to create invite.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (code: string) => {
    setDeletingInviteCode(code);
    setInviteError('');
    try {
      await deleteInvite(code);
      setInvites((prev) => prev.filter((i) => i.code !== code));
    } catch {
      setInviteError('Failed to delete invite.');
    } finally {
      setDeletingInviteCode(null);
    }
  };

  const handleCopyInvite = (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Initialize edit name when modal opens with a server
  const displayName = hasEditedName ? editName : (server?.name ?? '');

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Server Settings">
      {server ? (
        <div className="space-y-6">
          {/* Server Name Section */}
          {isOwner && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-[#96989d]">
                Server Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setHasEditedName(true);
                  }}
                  className="flex-1 rounded bg-[#202225] px-3 py-2 text-[#dcddde] placeholder-[#72767d] outline-none focus:ring-2 focus:ring-[#5865f2]"
                  maxLength={100}
                />
                {hasEditedName && editName.trim() !== server.name && (
                  <button
                    onClick={handleSaveName}
                    disabled={isUpdating || !editName.trim()}
                    className="flex items-center gap-2 rounded bg-[#5865f2] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating && <LoadingSpinner size={14} />}
                    Save
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Server Info */}
          {!isOwner && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-[#96989d]">
                Server Name
              </label>
              <p className="text-[#dcddde]">{server.name}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-[#96989d]">
              Server ID
            </label>
            <p className="text-sm text-[#96989d]">{server.id}</p>
          </div>

          {/* Invites Section */}
          <div className="border-t border-[#42444a] pt-4">
            <label className="mb-2 block text-xs font-bold uppercase text-[#96989d]">
              Invites
            </label>

            {canCreateInvite && (
              <button
                onClick={handleCreateInvite}
                disabled={isCreatingInvite}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded bg-[#5865f2] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingInvite ? <LoadingSpinner size={14} /> : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                )}
                Generate Invite Link
              </button>
            )}

            {isLoadingInvites ? (
              <div className="flex justify-center py-2">
                <LoadingSpinner size={20} className="text-[#96989d]" />
              </div>
            ) : invites.length > 0 ? (
              <div className="space-y-1.5">
                {invites.map((invite) => {
                  const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
                  const isMaxed = invite.maxUses !== null && invite.useCount >= invite.maxUses;

                  return (
                    <div
                      key={invite.code}
                      className={`flex items-center gap-2 rounded bg-[#202225] px-3 py-2 ${isExpired || isMaxed ? 'opacity-50' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-mono text-[#dcddde]">
                          {window.location.origin}/invite/{invite.code}
                        </p>
                        <p className="text-xs text-[#72767d]">
                          {invite.useCount} use{invite.useCount !== 1 ? 's' : ''}
                          {invite.maxUses !== null && ` / ${invite.maxUses} max`}
                          {isExpired && ' \u00b7 Expired'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopyInvite(invite.code)}
                        className="rounded p-1.5 text-[#96989d] transition-colors hover:text-[#dcddde]"
                        title="Copy invite link"
                      >
                        {copiedCode === invite.code ? (
                          <svg className="h-4 w-4 text-[#3ba55c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                      {canManageServer && (
                        <button
                          onClick={() => handleDeleteInvite(invite.code)}
                          disabled={deletingInviteCode === invite.code}
                          className="rounded p-1.5 text-[#96989d] transition-colors hover:text-[#ed4245] disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete invite"
                        >
                          {deletingInviteCode === invite.code ? (
                            <LoadingSpinner size={14} />
                          ) : (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-1 text-center text-sm text-[#72767d]">No active invites.</p>
            )}

            {inviteError && (
              <p className="mt-2 text-sm text-[#ed4245]">{inviteError}</p>
            )}
          </div>

          {/* Roles Section */}
          <div className="border-t border-[#42444a] pt-4">
            <label className="mb-2 block text-xs font-bold uppercase text-[#96989d]">
              Roles
            </label>

            {/* Create Role */}
            {canManageRoles && (
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="New role name"
                  className="flex-1 rounded bg-[#202225] px-3 py-1.5 text-sm text-[#dcddde] placeholder-[#72767d] outline-none focus:ring-2 focus:ring-[#5865f2]"
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateRole();
                  }}
                />
                <button
                  onClick={handleCreateRole}
                  disabled={isCreatingRole || !newRoleName.trim()}
                  className="flex items-center gap-1 rounded bg-[#3ba55d] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#2d7d46] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingRole && <LoadingSpinner size={14} />}
                  + Create
                </button>
              </div>
            )}

            {/* Role List */}
            {isLoadingRoles ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size={24} className="text-[#96989d]" />
              </div>
            ) : (
              <div className="space-y-1">
                {sortedRoles.map((role) => {
                  const nonDefaultIndex = nonDefaultRoles.findIndex((r) => r.id === role.id);
                  const isFirst = nonDefaultIndex === 0;
                  const isLast = nonDefaultIndex === nonDefaultRoles.length - 1;
                  const isEditing = editingRoleId === role.id;

                  return (
                    <div key={role.id}>
                      <div
                        className={`flex items-center gap-2 px-2 py-1.5 ${isEditing ? 'rounded-t bg-[#202225]' : 'rounded bg-[#2f3136] hover:bg-[#36393f]'} ${canManageRoles ? 'cursor-pointer' : ''}`}
                        onClick={() => canManageRoles && handleEditRole(role)}
                      >
                        {/* Up/Down Buttons */}
                        {canManageRoles && (
                          <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleMoveRole(role.id, 'up')}
                              disabled={role.isDefault || isFirst || isReordering}
                              className="rounded p-0.5 text-[#96989d] transition-colors hover:text-[#dcddde] disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Move up"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 15l-6-6-6 6" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveRole(role.id, 'down')}
                              disabled={role.isDefault || isLast || isReordering}
                              className="rounded p-0.5 text-[#96989d] transition-colors hover:text-[#dcddde] disabled:opacity-30 disabled:cursor-not-allowed"
                              aria-label="Move down"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Role Color Dot */}
                        <span
                          className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                          style={{
                            backgroundColor: role.color
                              ? `#${role.color.toString(16).padStart(6, '0')}`
                              : '#99aab5',
                          }}
                        />

                        {/* Role Name */}
                        <span className="flex-1 truncate text-sm text-[#dcddde]">
                          {role.name}
                        </span>

                        {/* Delete Button */}
                        {canManageRoles && !role.isDefault && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                            disabled={deletingRoleId === role.id}
                            className="rounded p-1 text-[#96989d] transition-colors hover:text-[#ed4245] disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={`Delete ${role.name}`}
                          >
                            {deletingRoleId === role.id ? (
                              <LoadingSpinner size={14} />
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expanded Role Editor */}
                      {isEditing && (
                        <div className="rounded-b bg-[#202225] px-3 py-3 space-y-3">
                          {/* Name and Color row */}
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={editRoleName}
                              onChange={(e) => setEditRoleName(e.target.value)}
                              className="flex-1 rounded bg-[#36393f] px-2 py-1.5 text-sm text-[#dcddde] outline-none focus:ring-2 focus:ring-[#5865f2] disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="Role name"
                              maxLength={100}
                              disabled={role.isDefault}
                            />
                            <input
                              type="color"
                              value={editRoleColor}
                              onChange={(e) => setEditRoleColor(e.target.value)}
                              className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                            />
                          </div>

                          {/* Permission categories */}
                          {PERMISSION_CATEGORIES.map((category) => (
                            <div key={category.name}>
                              <h4 className="mb-1.5 text-xs font-semibold uppercase text-[#96989d]">
                                {category.name}
                              </h4>
                              <div className="space-y-1">
                                {category.permissions.map(({ flag, label, description }) => (
                                  <label
                                    key={label}
                                    className="flex items-center justify-between rounded px-2 py-1 hover:bg-[#36393f] cursor-pointer"
                                  >
                                    <div>
                                      <span className="text-sm text-[#dcddde]">{label}</span>
                                      <p className="text-xs text-[#72767d]">{description}</p>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={checkPermission(editRolePermissions, flag)}
                                      onChange={() => handleTogglePermission(flag)}
                                      className="h-4 w-4 accent-[#5865f2]"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}

                          {/* Save / Cancel buttons */}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 rounded px-3 py-1.5 text-sm text-[#dcddde] hover:underline"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveRole}
                              disabled={isSavingRole}
                              className="flex-1 flex items-center justify-center gap-1 rounded bg-[#5865f2] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSavingRole && <LoadingSpinner size={14} />}
                              Save Changes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {sortedRoles.length === 0 && (
                  <p className="py-2 text-center text-sm text-[#72767d]">No roles found.</p>
                )}
              </div>
            )}

            {roleError && (
              <p className="mt-2 text-sm text-[#ed4245]">{roleError}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-[#ed4245]">{error}</p>
          )}

          {/* Delete Server Section - Owner Only */}
          {isOwner && (
            <div className="border-t border-[#42444a] pt-4">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded border border-[#ed4245] px-4 py-2 text-sm font-medium text-[#ed4245] transition-colors hover:bg-[#ed4245] hover:text-white"
                >
                  Delete Server
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#ed4245]">
                    Are you sure you want to delete{' '}
                    <span className="font-semibold">{server.name}</span>? This
                    action cannot be undone. All channels, messages, and data
                    will be permanently deleted.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded px-4 py-2 text-sm text-[#dcddde] hover:underline"
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex flex-1 items-center justify-center gap-2 rounded bg-[#ed4245] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c03537] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting && <LoadingSpinner size={14} />}
                      Delete Server
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[#96989d]">No server selected.</p>
      )}
    </Modal>
  );
}

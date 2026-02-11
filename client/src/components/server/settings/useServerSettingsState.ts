import { useState, useEffect, useCallback } from 'react';
import type { Role, Invite } from '@harmonium/shared';
import { useServerStore } from '../../../stores/server.store.js';
import { useUIStore } from '../../../stores/ui.store.js';
import { useAuthStore } from '../../../stores/auth.store.js';
import { deleteServer, updateServer } from '../../../api/servers.js';
import { getRoles, createRole, deleteRole, reorderRoles, updateRole } from '../../../api/roles.js';
import { createInvite, getServerInvites, deleteInvite } from '../../../api/invites.js';
import {
  Permission,
  hasPermission as checkPermission,
  addPermission,
  removePermission,
  permissionToString,
  stringToPermission,
} from '@harmonium/shared';
import { usePermissions } from '../../../hooks/usePermissions.js';

export const PERMISSION_CATEGORIES = [
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

export function useServerSettingsState() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState('');
  const [hasEditedName, setHasEditedName] = useState(false);

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
  const isOwner = !!(server && user && server.ownerId === user.id);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingInviteCode, setDeletingInviteCode] = useState<string | null>(null);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editRoleColor, setEditRoleColor] = useState<string>('#99aab5');
  const [editRolePermissions, setEditRolePermissions] = useState(0n);
  const [isSavingRole, setIsSavingRole] = useState(false);

  const { hasPermission } = usePermissions(currentServerId, roles);
  const canManageRoles = isOwner || hasPermission(Permission.MANAGE_ROLES);
  const canManageServer = isOwner || hasPermission(Permission.MANAGE_SERVER);
  const canCreateInvite = isOwner || hasPermission(Permission.CREATE_INVITE);

  const fetchInvites = useCallback(async () => {
    if (!currentServerId || !canManageServer) return;
    setIsLoadingInvites(true);
    setInviteError('');
    try {
      const fetched = await getServerInvites(currentServerId);
      setInvites(fetched);
    } catch {
      // May not have permission
    } finally {
      setIsLoadingInvites(false);
    }
  }, [currentServerId, canManageServer]);

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

  const handleClose = useCallback(() => {
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
  }, [closeModal]);

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
      const updated = await updateServer(currentServerId, { name: editName.trim() });
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

  const displayName = hasEditedName ? editName : (server?.name ?? '');

  return {
    isOpen,
    handleClose,
    server,
    currentServerId,
    isOwner,
    canManageRoles,
    canManageServer,
    canCreateInvite,
    // Overview
    displayName,
    hasEditedName,
    isUpdating,
    setEditName,
    setHasEditedName,
    handleSaveName,
    error,
    // Roles
    roles,
    sortedRoles,
    nonDefaultRoles,
    isLoadingRoles,
    isReordering,
    roleError,
    newRoleName,
    setNewRoleName,
    isCreatingRole,
    deletingRoleId,
    handleCreateRole,
    handleDeleteRole,
    handleMoveRole,
    editingRoleId,
    editRoleName,
    setEditRoleName,
    editRoleColor,
    setEditRoleColor,
    editRolePermissions,
    isSavingRole,
    handleEditRole,
    handleCancelEdit,
    handleTogglePermission,
    handleSaveRole,
    // Invites
    invites,
    isLoadingInvites,
    isCreatingInvite,
    inviteError,
    copiedCode,
    deletingInviteCode,
    handleCreateInvite,
    handleDeleteInvite,
    handleCopyInvite,
    // Delete
    isDeleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDelete,
  };
}

export type ServerSettingsStateType = ReturnType<typeof useServerSettingsState>;

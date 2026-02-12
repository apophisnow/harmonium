import { useState } from 'react';
import type { Role } from '@harmonium/shared';
import { hasPermission as checkPermission } from '@harmonium/shared';
import { PERMISSION_CATEGORIES } from './useServerSettingsState.js';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface RolesTabProps {
  canManageRoles: boolean;
  sortedRoles: Role[];
  nonDefaultRoles: Role[];
  isLoadingRoles: boolean;
  isReordering: boolean;
  roleError: string;
  newRoleName: string;
  setNewRoleName: (name: string) => void;
  isCreatingRole: boolean;
  deletingRoleId: string | null;
  handleCreateRole: () => void;
  handleDeleteRole: (roleId: string) => void;
  handleMoveRole: (roleId: string, direction: 'up' | 'down') => void;
  editingRoleId: string | null;
  editRoleName: string;
  setEditRoleName: (name: string) => void;
  editRoleColor: string;
  setEditRoleColor: (color: string) => void;
  editRolePermissions: bigint;
  isSavingRole: boolean;
  handleEditRole: (role: Role) => void;
  handleCancelEdit: () => void;
  handleTogglePermission: (flag: bigint) => void;
  handleSaveRole: () => void;
}

export function RolesTab({
  canManageRoles,
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
}: RolesTabProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const selectedRole = sortedRoles.find((r) => r.id === selectedRoleId);

  const handleSelectRole = (role: Role) => {
    setSelectedRoleId(role.id);
    handleEditRole(role);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Roles</h2>
      </div>

      {/* Create Role */}
      {canManageRoles && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="New role name"
            className="flex-1 rounded bg-th-bg-tertiary px-3 py-2 text-sm text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
            maxLength={100}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateRole();
            }}
          />
          <button
            onClick={handleCreateRole}
            disabled={isCreatingRole || !newRoleName.trim()}
            className="flex items-center gap-1 rounded bg-th-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreatingRole && <LoadingSpinner size={14} />}
            Create Role
          </button>
        </div>
      )}

      {roleError && <p className="text-sm text-th-red">{roleError}</p>}

      {isLoadingRoles ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size={24} className="text-th-text-secondary" />
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Left: Role list */}
          <div className="w-[200px] flex-shrink-0 space-y-0.5">
            {sortedRoles.map((role) => {
              const ndIdx = nonDefaultRoles.findIndex((r) => r.id === role.id);
              const isFirst = ndIdx === 0;
              const isLast = ndIdx === nonDefaultRoles.length - 1;
              const isActive = selectedRoleId === role.id;

              return (
                <div
                  key={role.id}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-th-bg-accent text-white'
                      : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
                  }`}
                  onClick={() => handleSelectRole(role)}
                >
                  {/* Reorder buttons */}
                  {canManageRoles && !role.isDefault && (
                    <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveRole(role.id, 'up')}
                        disabled={isFirst || isReordering}
                        className="rounded p-0.5 text-th-text-secondary transition-colors hover:text-th-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveRole(role.id, 'down')}
                        disabled={isLast || isReordering}
                        className="rounded p-0.5 text-th-text-secondary transition-colors hover:text-th-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <span
                    className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                    style={{
                      backgroundColor: role.color
                        ? `#${role.color.toString(16).padStart(6, '0')}`
                        : '#99aab5',
                    }}
                  />
                  <span className="flex-1 truncate text-sm">{role.name}</span>
                </div>
              );
            })}
            {sortedRoles.length === 0 && (
              <p className="py-4 text-center text-sm text-th-text-muted">No roles found.</p>
            )}
          </div>

          {/* Right: Permission editor */}
          <div className="flex-1 min-w-0">
            {selectedRole && editingRoleId === selectedRole.id ? (
              <div className="space-y-4 rounded-lg bg-th-bg-secondary p-4">
                {/* Name and Color */}
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-th-text-tertiary">
                    Role Name
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={editRoleName}
                      onChange={(e) => setEditRoleName(e.target.value)}
                      className="flex-1 rounded bg-th-bg-tertiary px-3 py-2 text-sm text-th-text-primary outline-none focus:ring-2 focus:ring-th-brand disabled:opacity-50"
                      placeholder="Role name"
                      maxLength={100}
                      disabled={selectedRole.isDefault}
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-th-text-tertiary">Color</label>
                      <input
                        type="color"
                        value={editRoleColor}
                        onChange={(e) => setEditRoleColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Permission categories */}
                {PERMISSION_CATEGORIES.map((category) => (
                  <div key={category.name}>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-th-text-tertiary">
                      {category.name}
                    </h4>
                    <div className="space-y-1">
                      {category.permissions.map(({ flag, label, description }) => (
                        <label
                          key={label}
                          className="flex items-center justify-between rounded px-3 py-2 hover:bg-th-bg-primary cursor-pointer"
                        >
                          <div>
                            <span className="text-sm text-th-text-primary">{label}</span>
                            <p className="text-xs text-th-text-muted">{description}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={checkPermission(editRolePermissions, flag)}
                            onChange={() => handleTogglePermission(flag)}
                            className="h-4 w-4 accent-th-brand"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-th-border pt-3">
                  <button
                    onClick={handleCancelEdit}
                    className="rounded px-4 py-2 text-sm text-th-text-primary hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRole}
                    disabled={isSavingRole}
                    className="flex items-center gap-1 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingRole && <LoadingSpinner size={14} />}
                    Save Changes
                  </button>
                  {canManageRoles && !selectedRole.isDefault && (
                    <button
                      onClick={() => handleDeleteRole(selectedRole.id)}
                      disabled={deletingRoleId === selectedRole.id}
                      className="ml-auto flex items-center gap-1 rounded px-4 py-2 text-sm text-th-red transition-colors hover:bg-th-red/10 disabled:opacity-50"
                    >
                      {deletingRoleId === selectedRole.id && <LoadingSpinner size={14} />}
                      Delete Role
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg bg-th-bg-secondary">
                <p className="text-sm text-th-text-muted">Select a role to edit its permissions</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

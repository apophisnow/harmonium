import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useServerSettingsState } from './useServerSettingsState.js';
import { ServerSettingsSidebar } from './ServerSettingsSidebar.js';
import type { SettingsTab } from './ServerSettingsSidebar.js';
import { OverviewTab } from './OverviewTab.js';
import { RolesTab } from './RolesTab.js';
import { MembersTab } from './MembersTab.js';
import { InvitesTab } from './InvitesTab.js';
import { DeleteServerTab } from './DeleteServerTab.js';

export function ServerSettingsLayout() {
  const state = useServerSettingsState();
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        state.handleClose();
      }
    },
    [state.handleClose],
  );

  useEffect(() => {
    if (state.isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [state.isOpen, handleEscape]);

  // Reset tab when opening
  useEffect(() => {
    if (state.isOpen) {
      setActiveTab('overview');
    }
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Left half - sidebar background */}
      <div className="flex flex-1 justify-end bg-[#2f3136]">
        <div className="w-[220px] overflow-y-auto px-2 py-[60px]">
          <ServerSettingsSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            serverName={state.server?.name ?? 'Server'}
            isOwner={state.isOwner}
          />
        </div>
      </div>

      {/* Right half - content */}
      <div className="flex flex-[1.5] bg-[#36393f]">
        <div className="w-[740px] max-w-full overflow-y-auto px-10 py-[60px]">
          {activeTab === 'overview' && (
            <OverviewTab
              server={state.server}
              isOwner={state.isOwner}
              displayName={state.displayName}
              hasEditedName={state.hasEditedName}
              isUpdating={state.isUpdating}
              setEditName={state.setEditName}
              setHasEditedName={state.setHasEditedName}
              handleSaveName={state.handleSaveName}
              error={state.error}
            />
          )}
          {activeTab === 'roles' && (
            <RolesTab
              canManageRoles={state.canManageRoles}
              sortedRoles={state.sortedRoles}
              nonDefaultRoles={state.nonDefaultRoles}
              isLoadingRoles={state.isLoadingRoles}
              isReordering={state.isReordering}
              roleError={state.roleError}
              newRoleName={state.newRoleName}
              setNewRoleName={state.setNewRoleName}
              isCreatingRole={state.isCreatingRole}
              deletingRoleId={state.deletingRoleId}
              handleCreateRole={state.handleCreateRole}
              handleDeleteRole={state.handleDeleteRole}
              handleMoveRole={state.handleMoveRole}
              editingRoleId={state.editingRoleId}
              editRoleName={state.editRoleName}
              setEditRoleName={state.setEditRoleName}
              editRoleColor={state.editRoleColor}
              setEditRoleColor={state.setEditRoleColor}
              editRolePermissions={state.editRolePermissions}
              isSavingRole={state.isSavingRole}
              handleEditRole={state.handleEditRole}
              handleCancelEdit={state.handleCancelEdit}
              handleTogglePermission={state.handleTogglePermission}
              handleSaveRole={state.handleSaveRole}
            />
          )}
          {activeTab === 'members' && (
            <MembersTab
              roles={state.roles}
              currentServerId={state.currentServerId}
              isOwner={state.isOwner}
            />
          )}
          {activeTab === 'invites' && (
            <InvitesTab
              canCreateInvite={state.canCreateInvite}
              canManageServer={state.canManageServer}
              invites={state.invites}
              isLoadingInvites={state.isLoadingInvites}
              isCreatingInvite={state.isCreatingInvite}
              inviteError={state.inviteError}
              copiedCode={state.copiedCode}
              deletingInviteCode={state.deletingInviteCode}
              handleCreateInvite={state.handleCreateInvite}
              handleDeleteInvite={state.handleDeleteInvite}
              handleCopyInvite={state.handleCopyInvite}
            />
          )}
          {activeTab === 'delete' && (
            <DeleteServerTab
              server={state.server}
              isOwner={state.isOwner}
              isDeleting={state.isDeleting}
              showDeleteConfirm={state.showDeleteConfirm}
              setShowDeleteConfirm={state.setShowDeleteConfirm}
              handleDelete={state.handleDelete}
              error={state.error}
            />
          )}
        </div>

        {/* ESC close button */}
        <div className="py-[60px] px-4">
          <button
            onClick={state.handleClose}
            className="group flex flex-col items-center gap-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#72767d] text-[#72767d] transition-colors group-hover:border-[#dcddde] group-hover:text-[#dcddde]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-[#72767d] group-hover:text-[#dcddde]">
              ESC
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

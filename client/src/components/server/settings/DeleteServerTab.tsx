import type { Server } from '@harmonium/shared';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface DeleteServerTabProps {
  server: Server | undefined;
  isOwner: boolean;
  isDeleting: boolean;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  handleDelete: () => void;
  error: string;
}

export function DeleteServerTab({
  server,
  isOwner,
  isDeleting,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleDelete,
  error,
}: DeleteServerTabProps) {
  if (!server || !isOwner) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Delete Server</h2>

      <div className="rounded-lg border border-[#ed4245]/30 bg-[#ed4245]/5 p-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ed4245]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
          </svg>
          <div>
            <h3 className="font-semibold text-[#ed4245]">Warning</h3>
            <p className="mt-1 text-sm text-[#dcddde]">
              Deleting a server is permanent and cannot be undone. All channels, messages,
              roles, and member data will be permanently deleted.
            </p>
          </div>
        </div>
      </div>

      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded border border-[#ed4245] px-6 py-2.5 text-sm font-medium text-[#ed4245] transition-colors hover:bg-[#ed4245] hover:text-white"
        >
          Delete Server
        </button>
      ) : (
        <div className="space-y-4 rounded-lg bg-[#2f3136] p-4">
          <p className="text-sm text-[#dcddde]">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-white">{server.name}</span>? This action
            cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded px-4 py-2 text-sm text-[#dcddde] hover:underline"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 rounded bg-[#ed4245] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c03537] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting && <LoadingSpinner size={14} />}
              Delete Server
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[#ed4245]">{error}</p>}
    </div>
  );
}

import { useState } from 'react';
import { Modal } from '../shared/Modal.js';
import { createServer } from '../../api/servers.js';
import { useServerStore } from '../../stores/server.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

export function CreateServerModal() {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const addServer = useServerStore((s) => s.addServer);

  const isOpen = activeModal === 'createServer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const server = await createServer(name.trim());
      addServer(server);
      setName('');
      closeModal();
    } catch {
      setError('Failed to create server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError('');
    closeModal();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create a Server">
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-sm text-[#96989d]">
          Your server is where you and your friends hang out. Make yours and
          start talking.
        </p>

        <label className="mb-2 block text-xs font-bold uppercase text-[#96989d]">
          Server Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Awesome Server"
          className="mb-4 w-full rounded bg-[#202225] px-3 py-2 text-[#dcddde] placeholder-[#72767d] outline-none focus:ring-2 focus:ring-[#5865f2]"
          autoFocus
          maxLength={100}
        />

        {error && (
          <p className="mb-4 text-sm text-[#ed4245]">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-4 py-2 text-sm text-[#dcddde] hover:underline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="flex items-center gap-2 rounded bg-[#5865f2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <LoadingSpinner size={16} />}
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

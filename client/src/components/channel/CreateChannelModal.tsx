import { useState } from 'react';
import type { ChannelType } from '@harmonium/shared';
import { Modal } from '../shared/Modal.js';
import { createChannel } from '../../api/channels.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

export function CreateChannelModal() {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const currentServerId = useServerStore((s) => s.currentServerId);
  const addChannel = useChannelStore((s) => s.addChannel);

  const isOpen = activeModal === 'createChannel';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentServerId) return;

    setIsSubmitting(true);
    setError('');

    try {
      const channel = await createChannel(currentServerId, {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        type,
      });
      addChannel(channel);
      setName('');
      setType('text');
      closeModal();
    } catch {
      setError('Failed to create channel. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType('text');
    setError('');
    closeModal();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Channel">
      <form onSubmit={handleSubmit}>
        {/* Channel Type */}
        <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">
          Channel Type
        </label>
        <div className="mb-4 space-y-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-md p-2.5 ${
              type === 'text' ? 'bg-th-bg-accent' : 'bg-th-bg-secondary hover:bg-th-bg-primary'
            }`}
          >
            <input
              type="radio"
              name="channelType"
              value="text"
              checked={type === 'text'}
              onChange={() => setType('text')}
              className="sr-only"
            />
            <span className="text-xl text-th-text-secondary">#</span>
            <div>
              <div className="text-sm font-medium text-th-text-primary">Text</div>
              <div className="text-xs text-th-text-secondary">
                Send messages, images, GIFs, and more
              </div>
            </div>
            <div
              className={`ml-auto h-5 w-5 rounded-full border-2 ${
                type === 'text'
                  ? 'border-th-brand bg-th-brand'
                  : 'border-th-text-muted'
              }`}
            >
              {type === 'text' && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-md p-2.5 ${
              type === 'voice' ? 'bg-th-bg-accent' : 'bg-th-bg-secondary hover:bg-th-bg-primary'
            }`}
          >
            <input
              type="radio"
              name="channelType"
              value="voice"
              checked={type === 'voice'}
              onChange={() => setType('voice')}
              className="sr-only"
            />
            <svg
              className="h-6 w-6 text-th-text-secondary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm7 9a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-2.07A7 7 0 0 0 19 11z" />
            </svg>
            <div>
              <div className="text-sm font-medium text-th-text-primary">Voice</div>
              <div className="text-xs text-th-text-secondary">
                Hang out together with voice and video
              </div>
            </div>
            <div
              className={`ml-auto h-5 w-5 rounded-full border-2 ${
                type === 'voice'
                  ? 'border-th-brand bg-th-brand'
                  : 'border-th-text-muted'
              }`}
            >
              {type === 'voice' && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Channel Name */}
        <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">
          Channel Name
        </label>
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text-secondary">
            {type === 'text' ? '#' : ''}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="new-channel"
            className={`w-full rounded bg-th-bg-tertiary py-2 pr-3 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand ${
              type === 'text' ? 'pl-7' : 'pl-3'
            }`}
            autoFocus
            maxLength={100}
          />
        </div>

        {error && (
          <p className="mb-4 text-sm text-th-red">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded px-4 py-2 text-sm text-th-text-primary hover:underline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="flex items-center gap-2 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <LoadingSpinner size={16} />}
            Create Channel
          </button>
        </div>
      </form>
    </Modal>
  );
}

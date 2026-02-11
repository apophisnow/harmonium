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
        <label className="mb-2 block text-xs font-bold uppercase text-[#96989d]">
          Channel Type
        </label>
        <div className="mb-4 space-y-2">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-md p-2.5 ${
              type === 'text' ? 'bg-[#40444b]' : 'bg-[#2f3136] hover:bg-[#36393f]'
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
            <span className="text-xl text-[#96989d]">#</span>
            <div>
              <div className="text-sm font-medium text-[#dcddde]">Text</div>
              <div className="text-xs text-[#96989d]">
                Send messages, images, GIFs, and more
              </div>
            </div>
            <div
              className={`ml-auto h-5 w-5 rounded-full border-2 ${
                type === 'text'
                  ? 'border-[#5865f2] bg-[#5865f2]'
                  : 'border-[#72767d]'
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
              type === 'voice' ? 'bg-[#40444b]' : 'bg-[#2f3136] hover:bg-[#36393f]'
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
              className="h-6 w-6 text-[#96989d]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm7 9a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21a1 1 0 1 0 2 0v-2.07A7 7 0 0 0 19 11z" />
            </svg>
            <div>
              <div className="text-sm font-medium text-[#dcddde]">Voice</div>
              <div className="text-xs text-[#96989d]">
                Hang out together with voice and video
              </div>
            </div>
            <div
              className={`ml-auto h-5 w-5 rounded-full border-2 ${
                type === 'voice'
                  ? 'border-[#5865f2] bg-[#5865f2]'
                  : 'border-[#72767d]'
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
        <label className="mb-2 block text-xs font-bold uppercase text-[#96989d]">
          Channel Name
        </label>
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#96989d]">
            {type === 'text' ? '#' : ''}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="new-channel"
            className={`w-full rounded bg-[#202225] py-2 pr-3 text-[#dcddde] placeholder-[#72767d] outline-none focus:ring-2 focus:ring-[#5865f2] ${
              type === 'text' ? 'pl-7' : 'pl-3'
            }`}
            autoFocus
            maxLength={100}
          />
        </div>

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
            Create Channel
          </button>
        </div>
      </form>
    </Modal>
  );
}

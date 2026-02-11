import { useState, useEffect } from 'react';
import type { Channel } from '@harmonium/shared';
import { Modal } from '../shared/Modal.js';
import { createInvite } from '../../api/invites.js';
import { useUIStore } from '../../stores/ui.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { useChannelStore } from '../../stores/channel.store.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

const EMPTY_CHANNELS: Channel[] = [];

export function InviteModal() {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const currentServerId = useServerStore((s) => s.currentServerId);
  const channels = useChannelStore((s) =>
    currentServerId ? (s.channels.get(currentServerId) ?? EMPTY_CHANNELS) : EMPTY_CHANNELS,
  );

  const isOpen = activeModal === 'invite';

  useEffect(() => {
    if (!isOpen || !currentServerId) return;

    const textChannel = channels.find((c) => c.type === 'text');
    if (!textChannel) return;

    let cancelled = false;
    setIsLoading(true);
    setError('');

    createInvite(currentServerId, textChannel.id)
      .then((invite) => {
        if (!cancelled) {
          setInviteCode(invite.code);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to generate invite link.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentServerId, channels]);

  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setCopied(false);
    setError('');
    closeModal();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Friends">
      <p className="mb-4 text-sm text-[#96989d]">
        Share this link with others to grant access to your server.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size={24} className="text-[#5865f2]" />
        </div>
      ) : error ? (
        <p className="py-4 text-sm text-[#ed4245]">{error}</p>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="flex-1 rounded bg-[#202225] px-3 py-2 text-sm text-[#dcddde] outline-none"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopy}
            className={`rounded px-4 py-2 text-sm font-medium text-white transition-colors ${
              copied
                ? 'bg-[#3ba55c]'
                : 'bg-[#5865f2] hover:bg-[#4752c4]'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </Modal>
  );
}

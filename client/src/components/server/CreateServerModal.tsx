import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../shared/Modal.js';
import { createServer } from '../../api/servers.js';
import { acceptInvite, getInviteInfo } from '../../api/invites.js';
import { useServerStore } from '../../stores/server.store.js';
import { useUIStore } from '../../stores/ui.store.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

type View = 'choose' | 'create' | 'join';

export function CreateServerModal() {
  const [view, setView] = useState<View>('choose');
  const [name, setName] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const addServer = useServerStore((s) => s.addServer);
  const fetchServers = useServerStore((s) => s.fetchServers);
  const navigate = useNavigate();

  const isOpen = activeModal === 'createServer';

  const handleClose = () => {
    setView('choose');
    setName('');
    setInviteInput('');
    setError('');
    closeModal();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const server = await createServer(name.trim());
      addServer(server);
      handleClose();
      navigate(`/channels/${server.id}`);
    } catch {
      setError('Failed to create server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const extractCode = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/invite\/([a-zA-Z0-9]+)\s*$/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
    return trimmed;
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = extractCode(inviteInput);
    if (!code) {
      setError('Please enter an invite link or code.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await getInviteInfo(code);
      const result = await acceptInvite(code);
      await fetchServers();
      handleClose();
      navigate(`/channels/${result.serverId}`);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setError(message ?? 'Invalid invite link or the invite has expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title =
    view === 'create'
      ? 'Create a Server'
      : view === 'join'
        ? 'Join a Server'
        : 'Add a Server';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      {view === 'choose' && (
        <div className="space-y-3">
          <p className="text-sm text-th-text-secondary">
            Create your own server or join one with an invite link.
          </p>

          <button
            onClick={() => setView('create')}
            className="flex w-full items-center gap-3 rounded-lg border border-th-border bg-th-bg-secondary px-4 py-3 text-left transition-colors hover:border-th-text-secondary hover:bg-th-bg-primary"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-th-brand">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-th-text-primary">Create My Own</p>
              <p className="text-xs text-th-text-secondary">Start a new server from scratch</p>
            </div>
          </button>

          <button
            onClick={() => setView('join')}
            className="flex w-full items-center gap-3 rounded-lg border border-th-border bg-th-bg-secondary px-4 py-3 text-left transition-colors hover:border-th-text-secondary hover:bg-th-bg-primary"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-th-green">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-th-text-primary">Join a Server</p>
              <p className="text-xs text-th-text-secondary">Enter an invite link to join</p>
            </div>
          </button>
        </div>
      )}

      {view === 'create' && (
        <form onSubmit={handleCreate}>
          <p className="mb-4 text-sm text-th-text-secondary">
            Your server is where you and your friends hang out. Make yours and
            start talking.
          </p>

          <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">
            Server Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              // Detect invite link pasted into name field
              if (val.includes('/invite/') || /^[a-zA-Z0-9]{6,10}$/.test(val.trim())) {
                setInviteInput(val);
                setName('');
                setError('');
                setView('join');
                return;
              }
              setName(val);
            }}
            placeholder="My Awesome Server"
            className="mb-4 w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
            autoFocus
            maxLength={100}
          />

          {error && (
            <p className="mb-4 text-sm text-th-red">{error}</p>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => { setView('choose'); setError(''); }}
              className="rounded px-4 py-2 text-sm text-th-text-secondary hover:text-th-text-primary transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <LoadingSpinner size={16} />}
              Create
            </button>
          </div>
        </form>
      )}

      {view === 'join' && (
        <form onSubmit={handleJoin}>
          <p className="mb-4 text-sm text-th-text-secondary">
            Enter an invite link or code below to join an existing server.
          </p>

          <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">
            Invite Link
          </label>
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => { setInviteInput(e.target.value); setError(''); }}
            placeholder="https://example.com/invite/abc123"
            className="mb-4 w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
            autoFocus
          />

          {error && (
            <p className="mb-4 text-sm text-th-red">{error}</p>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => { setView('choose'); setError(''); }}
              className="rounded px-4 py-2 text-sm text-th-text-secondary hover:text-th-text-primary transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !inviteInput.trim()}
              className="flex items-center gap-2 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <LoadingSpinner size={16} />}
              Join Server
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

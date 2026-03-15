import { useState } from 'react';
import { useRelationshipStore } from '../../stores/relationship.store.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';

export function AddFriend() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const sendFriendRequest = useRelationshipStore((s) => s.sendFriendRequest);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const parts = input.trim().split('#');
    if (parts.length !== 2 || !parts[0] || parts[1].length !== 4) {
      setError('Please enter a username in the format Username#0000');
      return;
    }

    const [username, discriminator] = parts;
    setIsLoading(true);

    try {
      await sendFriendRequest(username, discriminator);
      setSuccess(`Friend request sent to ${input.trim()}!`);
      setInput('');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to send friend request')
          : 'Failed to send friend request';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-b border-th-border p-4">
      <h2 className="mb-1 text-sm font-bold uppercase text-th-text-primary">Add Friend</h2>
      <p className="mb-3 text-sm text-th-text-secondary">
        You can add friends with their username and discriminator.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError('');
            setSuccess('');
          }}
          placeholder="Username#0000"
          className="flex-1 rounded bg-th-bg-tertiary px-3 py-2 text-sm text-th-text-primary placeholder-th-text-secondary outline-none focus:ring-2 focus:ring-th-brand"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50"
        >
          {isLoading ? <LoadingSpinner size={16} /> : 'Send Friend Request'}
        </button>
      </form>
      {success && <p className="mt-2 text-sm text-th-green">{success}</p>}
      {error && <p className="mt-2 text-sm text-th-red">{error}</p>}
    </div>
  );
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PinnedMessages } from '../PinnedMessages.js';
import { useMessageStore } from '../../../stores/message.store.js';
import type { Message } from '@harmonium/shared';

vi.mock('../../../api/messages.js', () => ({
  unpinMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../user/UserAvatar.js', () => ({
  UserAvatar: ({ username }: { username: string }) => (
    <div data-testid="avatar">{username}</div>
  ),
}));

vi.mock('../../../lib/formatters.js', () => ({
  formatDate: (iso: string) => iso,
}));

import { unpinMessage } from '../../../api/messages.js';

const makePinnedMessage = (id: string, content: string, username = 'TestUser'): Message => ({
  id,
  channelId: 'c1',
  authorId: 'user-1',
  content,
  editedAt: null,
  isDeleted: false,
  isPinned: true,
  pinnedAt: '2025-01-01T12:00:00Z',
  pinnedBy: 'user-1',
  replyToId: null,
  createdAt: '2025-01-01T00:00:00Z',
  author: {
    id: 'user-1',
    username,
    avatarUrl: null,
    status: 'online',
    customStatus: null,
  },
});

describe('PinnedMessages', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    useMessageStore.setState({
      pinnedMessages: new Map(),
    });
    vi.clearAllMocks();
    // Mock fetchPinnedMessages to avoid real API calls
    useMessageStore.setState({
      fetchPinnedMessages: vi.fn(),
    });
  });

  it('renders empty state when no pinned messages', () => {
    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(screen.getByText('No pinned messages yet')).toBeInTheDocument();
    expect(screen.getByText('Right-click a message to pin it')).toBeInTheDocument();
  });

  it('renders the header with title and close button', () => {
    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(screen.getByText('Pinned Messages')).toBeInTheDocument();
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    fireEvent.click(screen.getByTitle('Close'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders pinned messages with author and content', () => {
    const messages = [
      makePinnedMessage('m1', 'First pinned', 'Alice'),
      makePinnedMessage('m2', 'Second pinned', 'Bob'),
    ];
    useMessageStore.setState({
      pinnedMessages: new Map([['c1', messages]]),
    });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(screen.getAllByText('Alice')).toHaveLength(2); // avatar + username
    expect(screen.getByText('First pinned')).toBeInTheDocument();
    expect(screen.getAllByText('Bob')).toHaveLength(2);
    expect(screen.getByText('Second pinned')).toBeInTheDocument();
  });

  it('renders "Unknown" for messages without an author', () => {
    const msg: Message = {
      ...makePinnedMessage('m1', 'Orphan message'),
      author: undefined,
    };
    useMessageStore.setState({
      pinnedMessages: new Map([['c1', [msg]]]),
    });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(screen.getAllByText('Unknown')).toHaveLength(2); // avatar + username span
  });

  it('shows unpin button when canUnpin is true', () => {
    useMessageStore.setState({
      pinnedMessages: new Map([['c1', [makePinnedMessage('m1', 'Pinned')]]]),
    });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={true} />);

    expect(screen.getByTitle('Unpin Message')).toBeInTheDocument();
  });

  it('hides unpin button when canUnpin is false', () => {
    useMessageStore.setState({
      pinnedMessages: new Map([['c1', [makePinnedMessage('m1', 'Pinned')]]]),
    });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(screen.queryByTitle('Unpin Message')).not.toBeInTheDocument();
  });

  it('calls unpinMessage API when unpin button is clicked', async () => {
    useMessageStore.setState({
      pinnedMessages: new Map([['c1', [makePinnedMessage('m1', 'Pinned')]]]),
    });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={true} />);

    fireEvent.click(screen.getByTitle('Unpin Message'));

    await waitFor(() => {
      expect(unpinMessage).toHaveBeenCalledWith('c1', 'm1');
    });
  });

  it('calls fetchPinnedMessages on mount', () => {
    const fetchPinnedMessages = vi.fn();
    useMessageStore.setState({ fetchPinnedMessages });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(fetchPinnedMessages).toHaveBeenCalledWith('c1');
  });

  it('shows [attachment] for messages with attachments but no content', () => {
    const msg: Message = {
      ...makePinnedMessage('m1', ''),
      content: null,
      attachments: [{
        id: 'a1',
        messageId: 'm1',
        filename: 'image.png',
        url: '/files/image.png',
        contentType: 'image/png',
        sizeBytes: 1024,
        width: 100,
        height: 100,
        createdAt: '2025-01-01T00:00:00Z',
      }],
    };
    useMessageStore.setState({
      pinnedMessages: new Map([['c1', [msg]]]),
    });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(screen.getByText('[attachment]')).toBeInTheDocument();
  });

  it('shows messages for the correct channel only', () => {
    useMessageStore.setState({
      pinnedMessages: new Map([
        ['c1', [makePinnedMessage('m1', 'Channel 1 pin')]],
        ['c2', [makePinnedMessage('m2', 'Channel 2 pin')]],
      ]),
    });

    render(<PinnedMessages channelId="c1" onClose={onClose} canUnpin={false} />);

    expect(screen.getByText('Channel 1 pin')).toBeInTheDocument();
    expect(screen.queryByText('Channel 2 pin')).not.toBeInTheDocument();
  });
});

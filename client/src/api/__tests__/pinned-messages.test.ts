import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../client.js';
import { getPinnedMessages, pinMessage, unpinMessage } from '../messages.js';

describe('pinned messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPinnedMessages calls GET /channels/:channelId/pins', async () => {
    const mockPinned = [
      { id: 'm1', channelId: 'c1', content: 'Pinned!', isPinned: true },
      { id: 'm2', channelId: 'c1', content: 'Also pinned', isPinned: true },
    ];
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockPinned });

    const result = await getPinnedMessages('c1');

    expect(apiClient.get).toHaveBeenCalledWith('/channels/c1/pins');
    expect(result).toEqual(mockPinned);
  });

  it('getPinnedMessages returns empty array when no pins', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    const result = await getPinnedMessages('c1');

    expect(result).toEqual([]);
  });

  it('pinMessage calls PUT /channels/:channelId/pins/:messageId', async () => {
    const mockMessage = {
      id: 'm1',
      channelId: 'c1',
      content: 'Now pinned',
      isPinned: true,
      pinnedAt: '2025-01-01T00:00:00Z',
      pinnedBy: 'user-1',
    };
    vi.mocked(apiClient.put).mockResolvedValue({ data: mockMessage });

    const result = await pinMessage('c1', 'm1');

    expect(apiClient.put).toHaveBeenCalledWith('/channels/c1/pins/m1');
    expect(result).toEqual(mockMessage);
  });

  it('unpinMessage calls DELETE /channels/:channelId/pins/:messageId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});

    await unpinMessage('c1', 'm1');

    expect(apiClient.delete).toHaveBeenCalledWith('/channels/c1/pins/m1');
  });
});

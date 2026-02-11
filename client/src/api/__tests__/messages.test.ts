import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

import { apiClient } from '../client.js';
import { getMessages, sendMessage, editMessage, deleteMessage } from '../messages.js';

describe('messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMessages calls GET /channels/:channelId/messages with params', async () => {
    const mockMessages = [
      { id: 'm1', channelId: 'c1', content: 'Hello' },
      { id: 'm2', channelId: 'c1', content: 'World' },
    ];
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockMessages });

    const result = await getMessages('c1', { before: 'm5', limit: 25 });

    expect(apiClient.get).toHaveBeenCalledWith('/channels/c1/messages', {
      params: { before: 'm5', limit: 25 },
    });
    expect(result).toEqual(mockMessages);
  });

  it('getMessages works without params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    const result = await getMessages('c1');

    expect(apiClient.get).toHaveBeenCalledWith('/channels/c1/messages', {
      params: undefined,
    });
    expect(result).toEqual([]);
  });

  it('sendMessage calls POST /channels/:channelId/messages with content (JSON)', async () => {
    const mockMessage = { id: 'm1', channelId: 'c1', content: 'Hello' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockMessage });

    const result = await sendMessage('c1', 'Hello');

    expect(apiClient.post).toHaveBeenCalledWith('/channels/c1/messages', {
      content: 'Hello',
    });
    expect(result).toEqual(mockMessage);
  });

  it('sendMessage uses FormData when files are provided', async () => {
    const mockMessage = { id: 'm1', channelId: 'c1', content: 'With file' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockMessage });

    const file = new File(['data'], 'test.txt', { type: 'text/plain' });
    const result = await sendMessage('c1', 'With file', [file]);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/channels/c1/messages',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    expect(result).toEqual(mockMessage);
  });

  it('editMessage calls PATCH /channels/:channelId/messages/:messageId', async () => {
    const mockMessage = { id: 'm1', channelId: 'c1', content: 'Edited' };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: mockMessage });

    const result = await editMessage('c1', 'm1', 'Edited');

    expect(apiClient.patch).toHaveBeenCalledWith('/channels/c1/messages/m1', {
      content: 'Edited',
    });
    expect(result).toEqual(mockMessage);
  });

  it('deleteMessage calls DELETE /channels/:channelId/messages/:messageId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});

    await deleteMessage('c1', 'm1');

    expect(apiClient.delete).toHaveBeenCalledWith('/channels/c1/messages/m1');
  });
});

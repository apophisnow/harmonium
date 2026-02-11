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
import { getServers, createServer, deleteServer, getMembers } from '../servers.js';

describe('servers API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getServers calls GET /servers', async () => {
    const mockServers = [
      { id: 's1', name: 'Server 1' },
      { id: 's2', name: 'Server 2' },
    ];
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockServers });

    const result = await getServers();

    expect(apiClient.get).toHaveBeenCalledWith('/servers');
    expect(result).toEqual(mockServers);
  });

  it('createServer calls POST /servers with name (JSON)', async () => {
    const mockServer = { id: 's1', name: 'New Server' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockServer });

    const result = await createServer('New Server');

    expect(apiClient.post).toHaveBeenCalledWith('/servers', { name: 'New Server' });
    expect(result).toEqual(mockServer);
  });

  it('createServer calls POST /servers with FormData when icon provided', async () => {
    const mockServer = { id: 's1', name: 'New Server' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockServer });

    const iconFile = new File(['icon'], 'icon.png', { type: 'image/png' });
    const result = await createServer('New Server', iconFile);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/servers',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    expect(result).toEqual(mockServer);
  });

  it('deleteServer calls DELETE /servers/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});

    await deleteServer('s1');

    expect(apiClient.delete).toHaveBeenCalledWith('/servers/s1');
  });

  it('getMembers calls GET /servers/:serverId/members', async () => {
    const mockMembers = [
      { serverId: 's1', userId: 'u1', nickname: null, joinedAt: '2025-01-01T00:00:00Z' },
    ];
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockMembers });

    const result = await getMembers('s1');

    expect(apiClient.get).toHaveBeenCalledWith('/servers/s1/members');
    expect(result).toEqual(mockMembers);
  });
});

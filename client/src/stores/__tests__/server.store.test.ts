import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useServerStore } from '../server.store.js';

vi.mock('../../api/servers.js', () => ({
  getServers: vi.fn(),
  getMembers: vi.fn(),
}));

import { getServers } from '../../api/servers.js';

const makeServer = (id: string, name: string) => ({
  id,
  name,
  iconUrl: null,
  ownerId: 'owner-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

describe('useServerStore', () => {
  beforeEach(() => {
    useServerStore.setState({
      servers: new Map(),
      currentServerId: null,
    });
    vi.clearAllMocks();
  });

  it('fetchServers populates Map from API', async () => {
    const serverList = [makeServer('s1', 'Server 1'), makeServer('s2', 'Server 2')];
    vi.mocked(getServers).mockResolvedValue(serverList);

    await useServerStore.getState().fetchServers();

    const state = useServerStore.getState();
    expect(getServers).toHaveBeenCalled();
    expect(state.servers.size).toBe(2);
    expect(state.servers.get('s1')).toEqual(serverList[0]);
    expect(state.servers.get('s2')).toEqual(serverList[1]);
  });

  it('setCurrentServer updates currentServerId', () => {
    useServerStore.getState().setCurrentServer('s1');
    expect(useServerStore.getState().currentServerId).toBe('s1');

    useServerStore.getState().setCurrentServer(null);
    expect(useServerStore.getState().currentServerId).toBeNull();
  });

  it('addServer adds a server to the Map', () => {
    const server = makeServer('s1', 'Server 1');
    useServerStore.getState().addServer(server);

    const state = useServerStore.getState();
    expect(state.servers.size).toBe(1);
    expect(state.servers.get('s1')).toEqual(server);
  });

  it('removeServer removes server from Map', () => {
    const server1 = makeServer('s1', 'Server 1');
    const server2 = makeServer('s2', 'Server 2');
    useServerStore.setState({
      servers: new Map([['s1', server1], ['s2', server2]]),
      currentServerId: 's2',
    });

    useServerStore.getState().removeServer('s1');

    const state = useServerStore.getState();
    expect(state.servers.size).toBe(1);
    expect(state.servers.has('s1')).toBe(false);
    expect(state.servers.has('s2')).toBe(true);
    expect(state.currentServerId).toBe('s2');
  });

  it('removeServer clears currentServerId if it matches the removed server', () => {
    const server = makeServer('s1', 'Server 1');
    useServerStore.setState({
      servers: new Map([['s1', server]]),
      currentServerId: 's1',
    });

    useServerStore.getState().removeServer('s1');

    const state = useServerStore.getState();
    expect(state.servers.size).toBe(0);
    expect(state.currentServerId).toBeNull();
  });

  it('updateServer replaces server in Map', () => {
    const server = makeServer('s1', 'Server 1');
    useServerStore.setState({
      servers: new Map([['s1', server]]),
    });

    const updated = { ...server, name: 'Updated Server' };
    useServerStore.getState().updateServer(updated);

    const state = useServerStore.getState();
    expect(state.servers.get('s1')?.name).toBe('Updated Server');
  });
});

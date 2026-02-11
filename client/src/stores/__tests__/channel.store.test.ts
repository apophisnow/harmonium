import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChannelStore } from '../channel.store.js';

vi.mock('../../api/channels.js', () => ({
  getChannels: vi.fn(),
}));

import { getChannels } from '../../api/channels.js';

const makeChannel = (id: string, serverId: string, name: string) => ({
  id,
  serverId,
  categoryId: null,
  name,
  type: 'text' as const,
  topic: null,
  position: 0,
  isPrivate: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

describe('useChannelStore', () => {
  beforeEach(() => {
    useChannelStore.setState({
      channels: new Map(),
      currentChannelId: null,
    });
    vi.clearAllMocks();
  });

  it('fetchChannels populates channels for a server', async () => {
    const channelList = [
      makeChannel('c1', 's1', 'general'),
      makeChannel('c2', 's1', 'random'),
    ];
    vi.mocked(getChannels).mockResolvedValue(channelList);

    await useChannelStore.getState().fetchChannels('s1');

    const state = useChannelStore.getState();
    expect(getChannels).toHaveBeenCalledWith('s1');
    expect(state.channels.get('s1')).toEqual(channelList);
  });

  it('setCurrentChannel updates currentChannelId', () => {
    useChannelStore.getState().setCurrentChannel('c1');
    expect(useChannelStore.getState().currentChannelId).toBe('c1');

    useChannelStore.getState().setCurrentChannel(null);
    expect(useChannelStore.getState().currentChannelId).toBeNull();
  });

  it('addChannel appends channel to the correct server list', () => {
    const channel = makeChannel('c1', 's1', 'general');
    useChannelStore.getState().addChannel(channel);

    const state = useChannelStore.getState();
    expect(state.channels.get('s1')).toEqual([channel]);
  });

  it('addChannel appends to existing list', () => {
    const ch1 = makeChannel('c1', 's1', 'general');
    const ch2 = makeChannel('c2', 's1', 'random');
    useChannelStore.setState({
      channels: new Map([['s1', [ch1]]]),
    });

    useChannelStore.getState().addChannel(ch2);

    const state = useChannelStore.getState();
    expect(state.channels.get('s1')).toEqual([ch1, ch2]);
  });

  it('removeChannel removes channel and clears currentChannelId if it matches', () => {
    const ch1 = makeChannel('c1', 's1', 'general');
    const ch2 = makeChannel('c2', 's1', 'random');
    useChannelStore.setState({
      channels: new Map([['s1', [ch1, ch2]]]),
      currentChannelId: 'c1',
    });

    useChannelStore.getState().removeChannel('c1', 's1');

    const state = useChannelStore.getState();
    expect(state.channels.get('s1')).toEqual([ch2]);
    expect(state.currentChannelId).toBeNull();
  });

  it('removeChannel does not clear currentChannelId if it does not match', () => {
    const ch1 = makeChannel('c1', 's1', 'general');
    const ch2 = makeChannel('c2', 's1', 'random');
    useChannelStore.setState({
      channels: new Map([['s1', [ch1, ch2]]]),
      currentChannelId: 'c2',
    });

    useChannelStore.getState().removeChannel('c1', 's1');

    const state = useChannelStore.getState();
    expect(state.channels.get('s1')).toEqual([ch2]);
    expect(state.currentChannelId).toBe('c2');
  });

  it('updateChannel replaces the matching channel in the list', () => {
    const ch1 = makeChannel('c1', 's1', 'general');
    const ch2 = makeChannel('c2', 's1', 'random');
    useChannelStore.setState({
      channels: new Map([['s1', [ch1, ch2]]]),
    });

    const updated = { ...ch1, name: 'announcements', topic: 'Important stuff' };
    useChannelStore.getState().updateChannel(updated);

    const state = useChannelStore.getState();
    const list = state.channels.get('s1')!;
    expect(list[0].name).toBe('announcements');
    expect(list[0].topic).toBe('Important stuff');
    expect(list[1]).toEqual(ch2);
  });
});

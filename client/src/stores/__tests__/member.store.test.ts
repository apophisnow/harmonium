import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemberStore } from '../member.store.js';

vi.mock('../../api/servers.js', () => ({
  getServers: vi.fn(),
  getMembers: vi.fn(),
}));

import { getMembers } from '../../api/servers.js';

const makeMember = (serverId: string, userId: string, username: string) => ({
  serverId,
  userId,
  nickname: null,
  joinedAt: '2025-01-01T00:00:00Z',
  user: {
    id: userId,
    username,
    discriminator: '0001',
    avatarUrl: null,
    aboutMe: null,
    status: 'online' as const,
    customStatus: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  roles: [],
});

describe('useMemberStore', () => {
  beforeEach(() => {
    useMemberStore.setState({
      members: new Map(),
    });
    vi.clearAllMocks();
  });

  it('fetchMembers populates members for a server', async () => {
    const memberList = [
      makeMember('s1', 'u1', 'User1'),
      makeMember('s1', 'u2', 'User2'),
    ];
    vi.mocked(getMembers).mockResolvedValue(memberList);

    await useMemberStore.getState().fetchMembers('s1');

    const state = useMemberStore.getState();
    expect(getMembers).toHaveBeenCalledWith('s1');
    expect(state.members.get('s1')).toEqual(memberList);
  });

  it('addMember adds a member and prevents duplicates', () => {
    const member1 = makeMember('s1', 'u1', 'User1');
    useMemberStore.getState().addMember('s1', member1);

    expect(useMemberStore.getState().members.get('s1')).toEqual([member1]);

    // Adding same user again should not duplicate
    useMemberStore.getState().addMember('s1', member1);
    expect(useMemberStore.getState().members.get('s1')).toEqual([member1]);
  });

  it('removeMember removes member by userId from specified server', () => {
    const member1 = makeMember('s1', 'u1', 'User1');
    const member2 = makeMember('s1', 'u2', 'User2');
    useMemberStore.setState({
      members: new Map([['s1', [member1, member2]]]),
    });

    useMemberStore.getState().removeMember('s1', 'u1');

    const state = useMemberStore.getState();
    expect(state.members.get('s1')!.length).toBe(1);
    expect(state.members.get('s1')![0].userId).toBe('u2');
  });

  it('updateMemberUser updates user data across all servers', () => {
    const member1 = makeMember('s1', 'u1', 'User1');
    const member2 = makeMember('s2', 'u1', 'User1');
    const member3 = makeMember('s2', 'u2', 'User2');
    useMemberStore.setState({
      members: new Map([
        ['s1', [member1]],
        ['s2', [member2, member3]],
      ]),
    });

    const updatedUser = {
      ...member1.user!,
      username: 'UpdatedUser1',
      avatarUrl: 'https://example.com/avatar.png',
    };

    useMemberStore.getState().updateMemberUser(updatedUser);

    const state = useMemberStore.getState();
    // Check s1 was updated
    expect(state.members.get('s1')![0].user!.username).toBe('UpdatedUser1');
    expect(state.members.get('s1')![0].user!.avatarUrl).toBe('https://example.com/avatar.png');
    // Check s2 was updated for u1 but not for u2
    const s2members = state.members.get('s2')!;
    expect(s2members.find((m) => m.userId === 'u1')!.user!.username).toBe('UpdatedUser1');
    expect(s2members.find((m) => m.userId === 'u2')!.user!.username).toBe('User2');
  });

  it('updateMemberUser does nothing if user not found in any server', () => {
    const member1 = makeMember('s1', 'u1', 'User1');
    useMemberStore.setState({
      members: new Map([['s1', [member1]]]),
    });

    const unknownUser = {
      id: 'u999',
      username: 'Unknown',
      discriminator: '0001',
      avatarUrl: null,
      aboutMe: null,
      status: 'online' as const,
      customStatus: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    useMemberStore.getState().updateMemberUser(unknownUser);

    // Should remain unchanged
    expect(useMemberStore.getState().members.get('s1')![0].user!.username).toBe('User1');
  });
});

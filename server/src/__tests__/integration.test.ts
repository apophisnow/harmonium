/**
 * Integration tests for all Harmonium features.
 * Requires a running server at localhost:3001 with a fresh database.
 *
 * Run: cd server && npx vitest run src/__tests__/integration.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ApiClient, registerUser, setupServerWithOwner, addMemberToServer } from './api-client.js';

// Shared state across test suites
let owner: ApiClient;
let member: ApiClient;
let serverId: string;
let channelId: string;

beforeAll(async () => {
  const setup = await setupServerWithOwner('Integration Test Server');
  owner = setup.owner;
  serverId = setup.serverId;
  channelId = setup.channelId;
  member = await addMemberToServer(owner, serverId);
}, 15_000);

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  it('registers a new user', async () => {
    const client = new ApiClient();
    const res = await client.register(`authtest_${Date.now()}`, `authtest_${Date.now()}@test.com`);
    expect(res.status).toBe(201);
    expect(res.data.accessToken).toBeTruthy();
    expect(res.data.user.id).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    const email = `dup_${Date.now()}@test.com`;
    const c1 = new ApiClient();
    await c1.register(`dup1_${Date.now()}`, email);
    const c2 = new ApiClient();
    const res = await c2.register(`dup2_${Date.now()}`, email);
    expect(res.ok).toBe(false);
  });
});

// ─── Servers & Channels ─────────────────────────────────────────────────────

describe('Servers', () => {
  it('creates a server with default channel', async () => {
    const res = await owner.createServer(`SrvTest_${Date.now()}`);
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();

    const channels = await owner.getChannels(res.data.id);
    expect(channels.ok).toBe(true);
    expect(channels.data.uncategorized.length).toBeGreaterThan(0);
  });

  it('invites and joins a member', async () => {
    const invite = await owner.createInvite(serverId);
    expect(invite.status).toBe(201);
    expect(invite.data.code).toBeTruthy();

    const newMember = await registerUser('joiner');
    const join = await newMember.acceptInvite(invite.data.code);
    expect(join.status).toBeLessThan(300);
  });
});

// ─── Messages ────────────────────────────────────────────────────────────────

describe('Messages', () => {
  let messageId: string;

  it('sends a message', async () => {
    const res = await owner.sendMessage(channelId, 'Hello integration test!');
    expect(res.status).toBe(201);
    expect(res.data.content).toBe('Hello integration test!');
    messageId = res.data.id;
  });

  it('retrieves messages', async () => {
    const res = await owner.getMessages(channelId);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('edits a message', async () => {
    // Messages use PATCH, not PUT
    const res = await owner.patch(`/api/channels/${channelId}/messages/${messageId}`, {
      content: 'Edited content',
    });
    expect(res.ok).toBe(true);
  });

  it('deletes a message', async () => {
    const msg = await owner.sendMessage(channelId, 'delete me');
    const res = await owner.delete(`/api/channels/${channelId}/messages/${msg.data.id}`);
    expect(res.ok).toBe(true);
  });
});

// ─── Reactions ───────────────────────────────────────────────────────────────

describe('Reactions', () => {
  let messageId: string;

  beforeAll(async () => {
    const msg = await owner.sendMessage(channelId, 'React to this!');
    messageId = msg.data.id;
  });

  it('adds a reaction', async () => {
    // Emoji needs to be URL-encoded
    const res = await owner.put(
      `/api/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent('👍')}`,
    );
    expect(res.ok).toBe(true);
  });

  it('removes a reaction', async () => {
    const res = await owner.delete(
      `/api/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent('👍')}`,
    );
    expect(res.ok).toBe(true);
  });
});

// ─── Pinning (Feature 07) ───────────────────────────────────────────────────

describe('Pinning', () => {
  let messageId: string;

  beforeAll(async () => {
    const msg = await owner.sendMessage(channelId, 'Pin this message');
    messageId = msg.data.id;
  });

  it('pins a message', async () => {
    const res = await owner.put(`/api/channels/${channelId}/pins/${messageId}`);
    expect(res.ok).toBe(true);
  });

  it('lists pinned messages', async () => {
    const res = await owner.get<unknown[]>(`/api/channels/${channelId}/pins`);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('unpins a message', async () => {
    const res = await owner.delete(`/api/channels/${channelId}/pins/${messageId}`);
    expect(res.ok).toBe(true);
  });
});

// ─── Search (Feature 08) ────────────────────────────────────────────────────

describe('Search', () => {
  beforeAll(async () => {
    await owner.sendMessage(channelId, 'unique_search_term_xyz for testing');
    // Small delay for tsvector indexing
    await new Promise(r => setTimeout(r, 200));
  });

  it('searches messages by content', async () => {
    const res = await owner.get<{ results: unknown[]; totalCount: number }>(
      `/api/search/messages?query=unique_search_term_xyz&serverId=${serverId}`,
    );
    expect(res.ok).toBe(true);
    expect(res.data.totalCount).toBeGreaterThan(0);
  });

  it('returns empty for non-matching query', async () => {
    const res = await owner.get<{ results: unknown[]; totalCount: number }>(
      `/api/search/messages?query=zzzznonexistent999&serverId=${serverId}`,
    );
    expect(res.ok).toBe(true);
    expect(res.data.totalCount).toBe(0);
  });
});

// ─── Bans (Feature 04) ──────────────────────────────────────────────────────

describe('Bans', () => {
  let banTarget: ApiClient;

  beforeAll(async () => {
    banTarget = await addMemberToServer(owner, serverId);
  });

  it('bans a member', async () => {
    const res = await owner.put(`/api/servers/${serverId}/bans/${banTarget.userId}`, {
      reason: 'Integration test ban',
    });
    // Ban returns 204 No Content
    expect(res.status).toBeLessThan(300);
  });

  it('lists bans', async () => {
    const res = await owner.get<unknown[]>(`/api/servers/${serverId}/bans`);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('prevents banned user from rejoining', async () => {
    const invite = await owner.createInvite(serverId);
    const res = await banTarget.acceptInvite(invite.data.code);
    expect(res.ok).toBe(false);
  });

  it('unbans a member', async () => {
    const res = await owner.delete(`/api/servers/${serverId}/bans/${banTarget.userId}`);
    // Unban returns 204 No Content
    expect(res.status).toBeLessThan(300);
  });
});

// ─── Audit Log (Feature 12) ─────────────────────────────────────────────────

describe('Audit Log', () => {
  it('returns audit log entries', async () => {
    const res = await owner.get<unknown[]>(`/api/servers/${serverId}/audit-log`);
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('filters by action type', async () => {
    const res = await owner.get<unknown[]>(`/api/servers/${serverId}/audit-log?action=MEMBER_BAN`);
    expect(res.ok).toBe(true);
  });

  it('denies non-admin access', async () => {
    const res = await member.get(`/api/servers/${serverId}/audit-log`);
    expect(res.ok).toBe(false);
  });
});

// ─── Webhooks (Feature 15) ──────────────────────────────────────────────────

describe('Webhooks', () => {
  let webhookId: string;
  let webhookToken: string;

  it('creates a webhook', async () => {
    const res = await owner.post<{ id: string; token: string }>(
      `/api/servers/${serverId}/webhooks`,
      { name: 'Test Webhook', channelId },
    );
    expect(res.ok).toBe(true);
    expect(res.data.token).toBeTruthy();
    webhookId = res.data.id;
    webhookToken = res.data.token;
  });

  it('lists webhooks', async () => {
    const res = await owner.get<unknown[]>(`/api/servers/${serverId}/webhooks`);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('executes a webhook (sends message)', async () => {
    const res = await new ApiClient().post(`/api/webhooks/${webhookId}/${webhookToken}`, {
      content: 'Hello from webhook!',
    });
    expect(res.ok).toBe(true);
  });

  it('webhook message appears in channel', async () => {
    const res = await owner.getMessages(channelId);
    const webhookMsg = res.data.find((m: any) => m.content === 'Hello from webhook!');
    expect(webhookMsg).toBeTruthy();
  });

  it('rejects invalid webhook token', async () => {
    const res = await new ApiClient().post(`/api/webhooks/${webhookId}/invalidtoken`, {
      content: 'Should fail',
    });
    expect(res.ok).toBe(false);
  });

  it('deletes a webhook', async () => {
    // Webhook delete uses the server-scoped route
    const res = await owner.delete(`/api/servers/${serverId}/webhooks/${webhookId}`);
    expect(res.status).toBeLessThan(300);
  });
});

// ─── Threads (Feature 11) ───────────────────────────────────────────────────

describe('Threads', () => {
  let originMessageId: string;
  let threadId: string;

  beforeAll(async () => {
    const msg = await owner.sendMessage(channelId, 'This message gets a thread');
    originMessageId = msg.data.id;
  });

  it('creates a thread from a message', async () => {
    const res = await owner.post<{ id: string }>(`/api/channels/${channelId}/threads`, {
      name: 'Test Thread',
      messageId: originMessageId,
    });
    expect(res.ok).toBe(true);
    expect(res.data.id).toBeTruthy();
    threadId = res.data.id;
  });

  it('lists threads in channel', async () => {
    const res = await owner.get<unknown[]>(`/api/channels/${channelId}/threads`);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('sends a message in thread (thread is a channel)', async () => {
    const res = await owner.sendMessage(threadId, 'Reply in thread');
    expect(res.status).toBe(201);
  });

  it('retrieves thread messages', async () => {
    const res = await owner.getMessages(threadId);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('prevents duplicate thread on same message', async () => {
    const res = await owner.post(`/api/channels/${channelId}/threads`, {
      name: 'Duplicate Thread',
      messageId: originMessageId,
    });
    expect(res.ok).toBe(false);
  });

  it('archives a thread', async () => {
    const res = await owner.post(`/api/threads/${threadId}/archive`);
    expect(res.status).toBeLessThan(300);
  });
});

// ─── Server Discovery (Feature 16) ──────────────────────────────────────────

describe('Discovery', () => {
  it('updates discovery settings with multiple categories', async () => {
    const res = await owner.patch(`/api/servers/${serverId}/discovery`, {
      isDiscoverable: true,
      description: 'A test server for discovery',
      categories: ['Gaming', 'Community', 'Education'],
    });
    expect(res.ok).toBe(true);
    expect(res.data.categories).toEqual(['Gaming', 'Community', 'Education']);
  });

  it('browses discoverable servers', async () => {
    const res = await owner.get<{ servers: unknown[] }>('/api/discovery/servers');
    expect(res.ok).toBe(true);
    expect(res.data.servers.length).toBeGreaterThan(0);
  });

  it('searches discoverable servers', async () => {
    const res = await owner.get<{ servers: unknown[] }>('/api/discovery/servers?query=Integration');
    expect(res.ok).toBe(true);
  });

  it('filters by any matching category', async () => {
    const res = await owner.get<{ servers: unknown[] }>('/api/discovery/servers?category=Community');
    expect(res.ok).toBe(true);
    expect(res.data.servers.length).toBeGreaterThan(0);
  });

  it('rejects more than 5 categories', async () => {
    const res = await owner.patch(`/api/servers/${serverId}/discovery`, {
      categories: ['Gaming', 'Music', 'Education', 'Community', 'Sports', 'Finance'],
    });
    expect(res.ok).toBe(false);
  });

  it('allows clearing categories', async () => {
    const res = await owner.patch(`/api/servers/${serverId}/discovery`, {
      categories: [],
    });
    expect(res.ok).toBe(true);
    expect(res.data.categories).toEqual([]);

    // Restore for subsequent tests
    await owner.patch(`/api/servers/${serverId}/discovery`, {
      categories: ['Gaming', 'Community'],
    });
  });

  it('returns empty when filtering by non-matching category', async () => {
    const res = await owner.get<{ servers: unknown[] }>('/api/discovery/servers?category=Finance');
    expect(res.ok).toBe(true);
    expect(res.data.servers.length).toBe(0);
  });

  it('discovery server response includes categories array', async () => {
    const res = await owner.get<{ categories: string[] }>(`/api/discovery/servers/${serverId}`);
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data.categories)).toBe(true);
    expect(res.data.categories).toContain('Gaming');
  });

  it('gets single discovery server', async () => {
    const res = await owner.get(`/api/discovery/servers/${serverId}`);
    expect(res.ok).toBe(true);
  });

  it('denies non-owner from changing discovery settings', async () => {
    const res = await member.patch(`/api/servers/${serverId}/discovery`, {
      isDiscoverable: false,
    });
    expect(res.ok).toBe(false);
  });
});

// ─── Emojis (Feature 10) ────────────────────────────────────────────────────

describe('Emojis', () => {
  it('lists server emojis (empty)', async () => {
    const res = await owner.get<unknown[]>(`/api/servers/${serverId}/emojis`);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBe(0);
  });
});

// ─── Friends / Relationships (Feature 06) ───────────────────────────────────

describe('Relationships', () => {
  let friend: ApiClient;

  beforeAll(async () => {
    friend = await registerUser('friend');
    // Enable friend requests from everyone so strangers can send requests
    await friend.patch('/api/users/@me/privacy', { friendRequestFromEveryone: true });
  });

  it('sends a friend request', async () => {
    // Need to get the friend's discriminator first
    const friendInfo = await friend.get<{ id: string; username: string; discriminator: string }>('/api/users/@me');
    const res = await owner.post('/api/relationships/friends', {
      username: friendInfo.data.username,
      discriminator: friendInfo.data.discriminator,
    });
    expect(res.status).toBeLessThan(300);
  });

  it('lists relationships', async () => {
    const res = await owner.get<unknown[]>('/api/relationships');
    expect(res.ok).toBe(true);
  });
});

// ─── DMs (Feature 05) ───────────────────────────────────────────────────────

describe('Direct Messages', () => {
  it('creates a DM channel', async () => {
    const res = await owner.post<{ id: string }>('/api/dm/channels', {
      recipientId: member.userId,
    });
    expect(res.ok).toBe(true);
    expect(res.data.id).toBeTruthy();
  });

  it('lists DM channels', async () => {
    const res = await owner.get<unknown[]>('/api/dm/channels');
    expect(res.ok).toBe(true);
  });
});

// ─── Privacy Settings ────────────────────────────────────────────────────────

describe('Privacy Settings', () => {
  it('returns default privacy settings', async () => {
    const res = await owner.get<{
      allowDmsFromServerMembers: boolean;
      friendRequestFromEveryone: boolean;
      friendRequestFromFof: boolean;
      friendRequestFromServerMembers: boolean;
    }>('/api/users/@me/privacy');
    expect(res.ok).toBe(true);
    expect(res.data.allowDmsFromServerMembers).toBe(true);
    expect(res.data.friendRequestFromEveryone).toBe(false);
    expect(res.data.friendRequestFromFof).toBe(true);
    expect(res.data.friendRequestFromServerMembers).toBe(true);
  });

  it('updates privacy settings', async () => {
    const res = await owner.patch<{
      allowDmsFromServerMembers: boolean;
      friendRequestFromEveryone: boolean;
    }>('/api/users/@me/privacy', {
      allowDmsFromServerMembers: false,
      friendRequestFromEveryone: true,
    });
    expect(res.ok).toBe(true);
    expect(res.data.allowDmsFromServerMembers).toBe(false);
    expect(res.data.friendRequestFromEveryone).toBe(true);
  });

  it('blocks DMs when disabled', async () => {
    // Create a user with DMs disabled
    const noDeems = await registerUser('nodeems');
    await noDeems.patch('/api/users/@me/privacy', {
      allowDmsFromServerMembers: false,
    });

    // A stranger tries to DM them
    const stranger = await registerUser('stranger');
    const res = await stranger.post('/api/dm/channels', {
      recipientId: noDeems.userId,
    });
    expect(res.ok).toBe(false);
  });

  it('blocks friend requests when all options disabled', async () => {
    // Create a user who rejects all friend requests
    const private_user = await registerUser('private');
    await private_user.patch('/api/users/@me/privacy', {
      friendRequestFromEveryone: false,
      friendRequestFromFof: false,
      friendRequestFromServerMembers: false,
    });

    // Get their username/discriminator
    const info = await private_user.get<{ username: string; discriminator: string }>('/api/users/@me');

    // A stranger tries to friend them
    const stranger = await registerUser('stranger2');
    const res = await stranger.post('/api/relationships/friends', {
      username: info.data.username,
      discriminator: info.data.discriminator,
    });
    expect(res.ok).toBe(false);
  });

  it('allows friend requests when friendRequestFromEveryone is on', async () => {
    const openUser = await registerUser('openuser');
    await openUser.patch('/api/users/@me/privacy', {
      friendRequestFromEveryone: true,
    });

    const info = await openUser.get<{ username: string; discriminator: string }>('/api/users/@me');
    const stranger = await registerUser('stranger3');
    const res = await stranger.post('/api/relationships/friends', {
      username: info.data.username,
      discriminator: info.data.discriminator,
    });
    expect(res.ok).toBe(true);
  });

  // Restore owner's settings for subsequent tests
  it('restores default settings', async () => {
    const res = await owner.patch('/api/users/@me/privacy', {
      allowDmsFromServerMembers: true,
      friendRequestFromEveryone: false,
    });
    expect(res.ok).toBe(true);
  });
});

// ─── Block & Ignore Enforcement ──────────────────────────────────────────────

describe('Block & Ignore Enforcement', () => {
  let userA: ApiClient;
  let userB: ApiClient;

  beforeAll(async () => {
    userA = await registerUser('blocktest_a');
    userB = await registerUser('blocktest_b');
  });

  it('ignore endpoint returns 204', async () => {
    const res = await userA.ignoreUser(userB.userId!);
    expect(res.status).toBe(204);
  });

  it('ignore appears in relationships list', async () => {
    const res = await userA.get<Array<{ user: { id: string }; type: string }>>('/api/relationships');
    expect(res.ok).toBe(true);
    const ignored = res.data.find((r) => r.user.id === userB.userId && r.type === 'ignored');
    expect(ignored).toBeTruthy();
  });

  it('ignore does NOT prevent DM creation', async () => {
    const res = await userB.createDmChannel(userA.userId!);
    expect(res.ok).toBe(true);
  });

  it('ignore does NOT prevent messaging', async () => {
    // Create DM from ignored user's side
    const dm = await userB.createDmChannel(userA.userId!);
    expect(dm.ok).toBe(true);

    const msg = await userB.sendMessage(dm.data.id, 'hello from ignored user');
    expect(msg.ok).toBe(true);
  });

  it('unignore endpoint returns 204', async () => {
    const res = await userA.unignoreUser(userB.userId!);
    expect(res.status).toBe(204);
  });

  it('block prevents DM creation', async () => {
    await userA.blockUser(userB.userId!);

    const res = await userB.createDmChannel(userA.userId!);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  it('block prevents messaging in existing DM', async () => {
    // Unblock first to create a DM, then re-block
    await userA.unblockUser(userB.userId!);
    const dm = await userA.createDmChannel(userB.userId!);
    expect(dm.ok).toBe(true);

    // Now block
    await userA.blockUser(userB.userId!);

    // userB tries to send a message in the DM
    const msg = await userB.sendMessage(dm.data.id, 'should fail');
    expect(msg.ok).toBe(false);
    expect(msg.status).toBe(403);
  });

  it('blocker also cannot message blocked user in DM', async () => {
    // userA blocked userB, so userA also can't send in the DM
    await userA.unblockUser(userB.userId!);
    const dm = await userA.createDmChannel(userB.userId!);
    expect(dm.ok).toBe(true);

    await userA.blockUser(userB.userId!);

    const msg = await userA.sendMessage(dm.data.id, 'should also fail');
    expect(msg.ok).toBe(false);
    expect(msg.status).toBe(403);
  });

  it('unblock restores DM ability', async () => {
    await userA.unblockUser(userB.userId!);

    const dm = await userA.createDmChannel(userB.userId!);
    expect(dm.ok).toBe(true);

    const msg = await userB.sendMessage(dm.data.id, 'hello again');
    expect(msg.ok).toBe(true);
  });
});

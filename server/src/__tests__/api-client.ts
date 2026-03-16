/**
 * Lightweight API test client for integration tests.
 * Wraps fetch with auth, JSON handling, and assertion helpers.
 */

const BASE_URL = process.env.TEST_API_URL ?? 'http://localhost:3001';

interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
}

export class ApiClient {
  private token: string | null = null;
  public userId: string | null = null;
  public username: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private headers(hasBody: boolean, extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra };
    if (hasBody) h['Content-Type'] = 'application/json';
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      method,
      headers: this.headers(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data: T;
    const text = await res.text();
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }

    return { status: res.status, ok: res.ok, data };
  }

  get<T = unknown>(path: string) { return this.request<T>('GET', path); }
  post<T = unknown>(path: string, body?: unknown) { return this.request<T>('POST', path, body); }
  put<T = unknown>(path: string, body?: unknown) { return this.request<T>('PUT', path, body); }
  patch<T = unknown>(path: string, body?: unknown) { return this.request<T>('PATCH', path, body); }
  delete<T = unknown>(path: string, body?: unknown) { return this.request<T>('DELETE', path, body); }

  // ===== Auth helpers =====

  async register(username: string, email: string, password = 'Password123!') {
    const res = await this.post<{ accessToken: string; user: { id: string; username: string } }>(
      '/api/auth/register',
      { username, email, password },
    );
    if (res.ok) {
      this.token = res.data.accessToken;
      this.userId = res.data.user.id;
      this.username = res.data.user.username;
    }
    return res;
  }

  async login(email: string, password = 'Password123!') {
    const res = await this.post<{ accessToken: string; user: { id: string; username: string } }>(
      '/api/auth/login',
      { email, password },
    );
    if (res.ok) {
      this.token = res.data.accessToken;
      this.userId = res.data.user.id;
      this.username = res.data.user.username;
    }
    return res;
  }

  // ===== Server helpers =====

  async createServer(name: string) {
    return this.post<{ id: string; name: string }>('/api/servers', { name });
  }

  async getChannels(serverId: string) {
    return this.get<{ uncategorized: Array<{ id: string; name: string; type: string }> }>(
      `/api/servers/${serverId}/channels`,
    );
  }

  async createInvite(serverId: string) {
    return this.post<{ code: string }>(`/api/servers/${serverId}/invites`, {});
  }

  async acceptInvite(code: string) {
    return this.post(`/api/invites/${code}/accept`);
  }

  // ===== Message helpers =====

  async sendMessage(channelId: string, content: string) {
    return this.post<{ id: string; content: string; channelId: string }>(
      `/api/channels/${channelId}/messages`,
      { content },
    );
  }

  async getMessages(channelId: string) {
    return this.get<Array<{ id: string; content: string }>>(
      `/api/channels/${channelId}/messages`,
    );
  }
}

/** Create a fresh user with a unique name */
let userCounter = 0;
export function createClient(): ApiClient {
  return new ApiClient();
}

export async function registerUser(prefix = 'user'): Promise<ApiClient> {
  const client = new ApiClient();
  const n = ++userCounter;
  const ts = Date.now();
  const res = await client.register(`${prefix}${n}_${ts}`, `${prefix}${n}_${ts}@test.com`);
  if (!res.ok) {
    throw new Error(`registerUser failed (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return client;
}

/** Register a user, create a server, and return both + the general channel ID */
export async function setupServerWithOwner(serverName = 'Test Server') {
  const owner = await registerUser('owner');
  const srv = await owner.createServer(serverName);
  if (!srv.ok) {
    throw new Error(`createServer failed (${srv.status}): ${JSON.stringify(srv.data)}`);
  }
  const channels = await owner.getChannels(srv.data.id);
  if (!channels.ok) {
    throw new Error(`getChannels failed (${channels.status}): ${JSON.stringify(channels.data)}`);
  }
  const generalChannel = channels.data.uncategorized.find(c => c.type === 'text');
  if (!generalChannel) {
    throw new Error(`No text channel found in uncategorized: ${JSON.stringify(channels.data)}`);
  }
  return { owner, serverId: srv.data.id, channelId: generalChannel.id };
}

/** Register user2, create invite, have user2 join */
export async function addMemberToServer(owner: ApiClient, serverId: string) {
  const member = await registerUser('member');
  const invite = await owner.createInvite(serverId);
  await member.acceptInvite(invite.data.code);
  return member;
}

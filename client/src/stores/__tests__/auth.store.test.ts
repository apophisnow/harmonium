import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/auth.js', () => ({
  loginApi: vi.fn(),
  registerApi: vi.fn(),
  logoutApi: vi.fn(),
}));

// Create a proper localStorage mock since Node 22's built-in localStorage
// conflicts with jsdom's in the vitest environment
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
  removeItem: vi.fn((key: string) => { storage.delete(key); }),
  clear: vi.fn(() => { storage.clear(); }),
  get length() { return storage.size; },
  key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
};
vi.stubGlobal('localStorage', localStorageMock);

import { useAuthStore } from '../auth.store.js';
import { loginApi, registerApi, logoutApi } from '../../api/auth.js';

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  discriminator: '0001',
  avatarUrl: null,
  aboutMe: null,
  status: 'online' as const,
  customStatus: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const mockAuthResponse = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
  user: mockUser,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
    });
    storage.clear();
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('login calls API and sets user, tokens, isAuthenticated, and localStorage', async () => {
    vi.mocked(loginApi).mockResolvedValue(mockAuthResponse);

    await useAuthStore.getState().login('test@example.com', 'password123');

    const state = useAuthStore.getState();
    expect(loginApi).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access-token-123');
    expect(state.refreshToken).toBe('refresh-token-456');
    expect(state.isAuthenticated).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-456');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
  });

  it('register calls API and sets user, tokens, isAuthenticated, and localStorage', async () => {
    vi.mocked(registerApi).mockResolvedValue(mockAuthResponse);

    await useAuthStore.getState().register('testuser', 'test@example.com', 'password123');

    const state = useAuthStore.getState();
    expect(registerApi).toHaveBeenCalledWith('testuser', 'test@example.com', 'password123');
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access-token-123');
    expect(state.refreshToken).toBe('refresh-token-456');
    expect(state.isAuthenticated).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
  });

  it('logout clears state and localStorage and calls logoutApi', async () => {
    vi.mocked(logoutApi).mockResolvedValue(undefined);

    useAuthStore.setState({
      user: mockUser,
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(logoutApi).toHaveBeenCalledWith('refresh-token-456');
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
  });

  it('logout still clears state even if API throws', async () => {
    vi.mocked(logoutApi).mockRejectedValue(new Error('Network error'));

    useAuthStore.setState({
      user: mockUser,
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
  });

  it('logout does not call logoutApi when there is no refreshToken', async () => {
    useAuthStore.setState({
      user: mockUser,
      accessToken: 'access-token-123',
      refreshToken: null,
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    expect(logoutApi).not.toHaveBeenCalled();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setTokens updates tokens in state and localStorage', () => {
    useAuthStore.getState().setTokens('new-access', 'new-refresh');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'new-access');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'new-refresh');
  });

  it('setUser updates user in state and localStorage', () => {
    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
  });

  it('hydrate restores state from valid localStorage data', () => {
    storage.set('accessToken', 'stored-access');
    storage.set('refreshToken', 'stored-refresh');
    storage.set('user', JSON.stringify(mockUser));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('stored-access');
    expect(state.refreshToken).toBe('stored-refresh');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('hydrate sets isLoading to false when no stored data', () => {
    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('hydrate clears storage on invalid JSON', () => {
    storage.set('accessToken', 'stored-access');
    storage.set('refreshToken', 'stored-refresh');
    storage.set('user', 'invalid-json{{{');

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
  });
});

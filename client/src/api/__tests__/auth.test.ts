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
import { loginApi, registerApi, refreshTokenApi, logoutApi } from '../auth.js';

describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loginApi calls POST /auth/login with email and password', async () => {
    const mockResponse = {
      data: {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        user: { id: 'u1', username: 'testuser' },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

    const result = await loginApi('test@example.com', 'password123');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result).toEqual(mockResponse.data);
  });

  it('registerApi calls POST /auth/register with username, email, and password', async () => {
    const mockResponse = {
      data: {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        user: { id: 'u1', username: 'newuser' },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

    const result = await registerApi('newuser', 'new@example.com', 'password123');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123',
    });
    expect(result).toEqual(mockResponse.data);
  });

  it('refreshTokenApi calls POST /auth/refresh with refreshToken', async () => {
    const mockResponse = {
      data: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        user: { id: 'u1', username: 'testuser' },
      },
    };
    vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

    const result = await refreshTokenApi('old-refresh-token');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh', {
      refreshToken: 'old-refresh-token',
    });
    expect(result).toEqual(mockResponse.data);
  });

  it('logoutApi calls POST /auth/logout with refreshToken', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});

    await logoutApi('refresh-token-123');

    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout', {
      refreshToken: 'refresh-token-123',
    });
  });
});

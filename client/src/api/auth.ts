import type { PublicUser } from '@harmonium/shared';
import { apiClient } from './client.js';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface RegisterVerifyResponse {
  message: string;
  email: string;
}

export type RegisterResponse = RegisterVerifyResponse | AuthResponse;

export async function loginApi(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return response.data;
}

export async function registerApi(
  username: string,
  email: string,
  password: string,
): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', {
    username,
    email,
    password,
  });
  return response.data;
}

export async function verifyEmailApi(token: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/verify-email', {
    token,
  });
  return response.data;
}

export async function resendVerificationApi(email: string): Promise<void> {
  await apiClient.post('/auth/resend-verification', { email });
}

export async function refreshTokenApi(
  refreshToken: string,
): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/refresh', {
    refreshToken,
  });
  return response.data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}

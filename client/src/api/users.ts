import type { PublicUser } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function getProfile(): Promise<PublicUser> {
  const response = await apiClient.get<PublicUser>('/users/@me');
  return response.data;
}

export async function updateProfile(
  data: Partial<Pick<PublicUser, 'username' | 'aboutMe' | 'customStatus'>>,
): Promise<PublicUser> {
  const response = await apiClient.patch<PublicUser>('/users/@me', data);
  return response.data;
}

export async function uploadAvatar(file: File): Promise<PublicUser> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await apiClient.put<PublicUser>(
    '/users/@me/avatar',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return response.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiClient.post('/users/@me/password', { currentPassword, newPassword });
}

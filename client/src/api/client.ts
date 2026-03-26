import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useToastStore } from '../stores/toast.store.js';

let refreshPromise: Promise<string> | null = null;

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Show toast notifications for non-401 errors
    const status = error.response?.status;
    if (status && status !== 401) {
      const toast = useToastStore.getState();
      if (status === 403) {
        toast.addToast('error', "You don't have permission to do that");
      } else if (status === 404) {
        toast.addToast('error', 'The requested resource was not found');
      } else if (status === 429) {
        toast.addToast('error', 'Too many requests. Please slow down.');
      } else if (status >= 500) {
        toast.addToast('error', 'Something went wrong. Please try again later.');
      }
    } else if (!error.response) {
      useToastStore.getState().addToast('error', 'Network error. Check your connection.');
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if this was the refresh request itself
    if (originalRequest.url === '/auth/refresh') {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        useToastStore.getState().addToast('error', 'Session expired. Please log in again.');
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      refreshPromise = axios.post('/api/auth/refresh', { refreshToken })
        .then((response) => {
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);
          return accessToken as string;
        })
        .catch((refreshError) => {
          useToastStore.getState().addToast('error', 'Session expired. Please log in again.');
          clearAuthAndRedirect();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const accessToken = await refreshPromise;
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

function clearAuthAndRedirect() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export { apiClient };

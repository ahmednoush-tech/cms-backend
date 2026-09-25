import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './client';
import { platformAdminTokenStorage } from '../auth/platformAdminTokenStorage';
import type { ApiErrorEnvelope, ApiErrorCode, ApiSuccessEnvelope } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * A SEPARATE axios instance from apiClient (api/client.ts) — only
 * ever attaches the platform admin token. No refresh-token flow: a
 * platform admin session is a single access token (an internal ops
 * tool for a small, known team). Expiry just means logging in
 * again.
 */
export const platformAdminApiClient = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

platformAdminApiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = platformAdminTokenStorage.getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

platformAdminApiClient.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiSuccessEnvelope<unknown>;
    return { ...response, data: envelope.data, meta: envelope.meta };
  },
  (error: AxiosError<ApiErrorEnvelope>) => {
    if (!error.response) {
      return Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Network error — check your connection.'));
    }

    if (error.response.status === 401) {
      platformAdminTokenStorage.clear();
      // Deliberately a DIFFERENT event name from 'auth:session-expired'
      // (the tenant flow) — a listener for that event redirects to
      // the tenant LoginPage, which would be wrong here.
      window.dispatchEvent(new CustomEvent('platform-admin:session-expired'));
    }

    const envelope = error.response.data;
    const firstError = envelope?.errors?.[0];
    const code = (firstError?.code as ApiErrorCode) ?? 'UNKNOWN';
    const message = Array.isArray(firstError?.message)
      ? firstError.message.join(' ')
      : (firstError?.message ?? 'An unexpected error occurred.');

    return Promise.reject(new ApiError(error.response.status, code, message));
  },
);

export async function platformAdminApiRequest<T>(
  config: AxiosRequestConfig,
): Promise<{ data: T; meta: Record<string, unknown> | null }> {
  const response = await platformAdminApiClient.request<T>(config);
  return { data: response.data, meta: (response as unknown as { meta: Record<string, unknown> | null }).meta };
}

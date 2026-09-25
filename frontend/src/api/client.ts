import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorEnvelope, ApiErrorCode, ApiSuccessEnvelope } from '../types/api';
import { tokenStorage } from '../auth/tokenStorage';

/**
 * ApiError — the single normalized error shape every part of the
 * app consumes. Wraps the backend's actual { data:null, meta:null,
 * errors:[{code,message}] } envelope (verified against
 * backend/src/common/filters/http-exception.filter.ts this
 * session) without inventing new fields.
 *
 * Per Phase 3A decision 7: the backend's error CONTRACT is not
 * modified. `message` is displayed exactly as the backend sends
 * it (no frontend re-wording) for 409/422 business-rule cases,
 * since those are free-text today. `code` is captured and typed
 * now specifically so that IF the backend later emits structured
 * per-rule codes, only the display layer (components consuming
 * ApiError) needs to add a translation lookup — this class and
 * every interceptor below already carry `code` end to end.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | 'UNKNOWN' | 'NETWORK_ERROR';

  constructor(status: number, code: ApiErrorCode | 'UNKNOWN' | 'NETWORK_ERROR', message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Exported so the notification stream (EventSource, which can't go through Axios) targets the same API as every other request. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

// ---------------------------------------------------------------
// Request interceptor: attach the access token. No page/component
// ever sets this header itself.
// ---------------------------------------------------------------
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ---------------------------------------------------------------
// Response interceptor: unwrap the success envelope, normalize
// errors, and handle the single-flight refresh-on-401 flow.
//
// The refresh contract is transcribed exactly from the backend
// (verified this session): POST /auth/refresh with
// { refreshToken } rotates the token — the OLD refresh token is
// denylisted server-side the moment the new pair is issued, so
// this file must always persist the NEWEST refresh token and
// never retry with a stale one. No new protocol invented.
// ---------------------------------------------------------------

let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, 'AUTHENTICATION_ERROR', 'No refresh token available.');
  }

  // Deliberately a raw axios call, NOT apiClient — must not carry
  // an (expired) Authorization header, and must not recursively
  // trigger this same interceptor.
  const response = await axios.post<ApiSuccessEnvelope<import('../types/auth').TokenPair>>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );

  const pair = response.data.data;
  tokenStorage.setTokens(pair.accessToken, pair.refreshToken);
  return pair.accessToken;
}

apiClient.interceptors.response.use(
  (response) => {
    // Unwrap { data, meta, errors: null } -> callers get plain
    // data, with meta attached as a non-enumerable-ish sibling via
    // response.meta for list endpoints (see api/endpoints usage).
    const envelope = response.data as ApiSuccessEnvelope<unknown>;
    return { ...response, data: envelope.data, meta: envelope.meta };
  },
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (!error.response) {
      return Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Network error — check your connection.'));
    }

    const status = error.response.status;
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');

    // Single-flight refresh-and-retry, exactly once per request.
    if (status === 401 && !isAuthEndpoint && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = performRefresh().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccessToken = await refreshPromise;
        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      } catch {
        tokenStorage.clear();
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(new ApiError(401, 'AUTHENTICATION_ERROR', 'Session expired.'));
      }
    }

    const envelope = error.response.data;
    const firstError = envelope?.errors?.[0];
    const code = (firstError?.code as ApiErrorCode) ?? 'UNKNOWN';
    const message = Array.isArray(firstError?.message)
      ? firstError.message.join(' ')
      : (firstError?.message ?? 'An unexpected error occurred.');

    return Promise.reject(new ApiError(status, code, message));
  },
);

/**
 * Typed wrapper so endpoint modules never touch axios directly.
 * `meta` is exposed for paginated list endpoints; callers that
 * don't need it simply ignore the second element.
 */
export async function apiRequest<T>(
  config: AxiosRequestConfig,
): Promise<{ data: T; meta: Record<string, unknown> | null }> {
  const response = await apiClient.request<T>(config);
  return { data: response.data, meta: (response as unknown as { meta: Record<string, unknown> | null }).meta };
}

import { apiRequest } from '../client';
import type { AuthContext, LoginInput, TokenPair } from '../../types/auth';

/**
 * Confirmed 1:1 against backend/src/modules/auth/auth.controller.ts
 * this session — exactly these six routes exist:
 *   POST /api/v1/auth/login            (public)
 *   POST /api/v1/auth/refresh          (public, requires valid refresh token)
 *   POST /api/v1/auth/logout           (authenticated)
 *   GET  /api/v1/auth/me               (authenticated)
 *   POST /api/v1/auth/forgot-password  (public)
 *   POST /api/v1/auth/reset-password   (public)
 */
export const authApi = {
  login: async (input: LoginInput): Promise<TokenPair> => {
    const { data } = await apiRequest<TokenPair>({ method: 'POST', url: '/auth/login', data: input });
    return data;
  },

  refresh: async (refreshToken: string): Promise<TokenPair> => {
    const { data } = await apiRequest<TokenPair>({ method: 'POST', url: '/auth/refresh', data: { refreshToken } });
    return data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiRequest<void>({ method: 'POST', url: '/auth/logout', data: { refreshToken } });
  },

  me: async (): Promise<AuthContext> => {
    const { data } = await apiRequest<AuthContext>({ method: 'GET', url: '/auth/me' });
    return data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const { data } = await apiRequest<{ message: string }>({ method: 'POST', url: '/auth/forgot-password', data: { email } });
    return data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await apiRequest<{ message: string }>({ method: 'POST', url: '/auth/reset-password', data: { token, newPassword } });
    return data;
  },
};

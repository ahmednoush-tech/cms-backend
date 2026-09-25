import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthReactContext, type SessionStatus } from './AuthContext';
import { authApi } from '../api/endpoints/auth';
import { tokenStorage } from './tokenStorage';
import type { AuthContext as AuthContextShape } from '../types/auth';
import { ApiError } from '../api/client';

/**
 * Session restoration, login, logout — exactly the flow described
 * in PHASE_3A_FRONTEND_DESIGN.md section C, transcribed from the
 * actual backend behavior (AuthService/JwtStrategy, verified this
 * session), not a separately invented protocol.
 *
 * On mount: if a refresh token exists, refresh immediately (never
 * trust a possibly-stale stored access token), then call /auth/me
 * to confirm the session is still valid server-side — this is
 * what catches an account locked/deactivated since the token was
 * issued, since the backend re-checks status on every request
 * (confirmed in JwtStrategy.validate()).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [user, setUser] = useState<AuthContextShape | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearProactiveRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleProactiveRefresh = useCallback(
    (expiresInSeconds: number) => {
      clearProactiveRefresh();
      // ~80% of the token's life, per the design doc's stated
      // strategy — transparent refresh before actual expiry,
      // reactive 401-triggered refresh (api/client.ts) remains
      // the fallback for anything this timer misses.
      const delayMs = Math.max(expiresInSeconds * 0.8, 5) * 1000;
      refreshTimerRef.current = setTimeout(async () => {
        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) return;
        try {
          const pair = await authApi.refresh(refreshToken);
          tokenStorage.setTokens(pair.accessToken, pair.refreshToken);
          scheduleProactiveRefresh(pair.expiresIn);
        } catch {
          // Reactive path (api/client.ts 401 handler) will catch
          // the next failed request if this proactive attempt
          // itself failed — no need to duplicate that handling here.
        }
      }, delayMs);
    },
    [clearProactiveRefresh],
  );

  const restoreSession = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      setStatus('unauthenticated');
      return;
    }
    try {
      const pair = await authApi.refresh(refreshToken);
      tokenStorage.setTokens(pair.accessToken, pair.refreshToken);
      const me = await authApi.me();
      setUser(me);
      setStatus('authenticated');
      scheduleProactiveRefresh(pair.expiresIn);
    } catch {
      tokenStorage.clear();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [scheduleProactiveRefresh]);

  useEffect(() => {
    restoreSession();
    return clearProactiveRefresh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session-expired event, dispatched by api/client.ts when a
  // reactive refresh (triggered by a 401) itself fails.
  useEffect(() => {
    const handler = () => {
      clearProactiveRefresh();
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [clearProactiveRefresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const pair = await authApi.login({ email, password });
      tokenStorage.setTokens(pair.accessToken, pair.refreshToken);
      const me = await authApi.me();
      setUser(me);
      setStatus('authenticated');
      scheduleProactiveRefresh(pair.expiresIn);
    },
    [scheduleProactiveRefresh],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    clearProactiveRefresh();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch (err) {
      // Safe logout (design doc section N): clear client state
      // regardless of whether server-side revocation succeeded —
      // a network blip during logout must never leave the user
      // stuck believing they're logged out when tokens are still
      // technically valid only in their own browser's memory.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      tokenStorage.clear();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [clearProactiveRefresh]);

  return (
    <AuthReactContext.Provider value={{ status, user, login, logout }}>{children}</AuthReactContext.Provider>
  );
}

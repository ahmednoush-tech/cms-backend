/**
 * Isolated token persistence. Per the Phase 3A design doc (section
 * N, decision 4): the refresh token is persisted to localStorage
 * so a session survives a page reload/tab close, matching typical
 * admin-tool expectations; the access token is kept here too for
 * simplicity in this foundation phase, re-derived via refresh on
 * every app load regardless (see auth/AuthProvider.tsx) rather
 * than trusted as-is from storage.
 *
 * Isolating this behind a small object (not scattered
 * localStorage.getItem calls) means the storage strategy can be
 * swapped later (e.g. to an httpOnly-cookie-based refresh flow,
 * flagged as a decision requiring a backend change) without
 * touching api/client.ts or auth/AuthProvider.tsx.
 */

const ACCESS_TOKEN_KEY = 'cms.accessToken';
const REFRESH_TOKEN_KEY = 'cms.refreshToken';

export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

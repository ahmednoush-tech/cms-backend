/**
 * Deliberately a SEPARATE localStorage key from tokenStorage.ts
 * ('cms.accessToken') — a platform admin token and a tenant user
 * token must never be readable through the same accessor, since
 * platform-admin-api-client.ts and api/client.ts each attach
 * whichever one they read to very differently-scoped backend
 * routes (see backend's PlatformAdminJwtStrategy vs JwtStrategy).
 */
const PLATFORM_ADMIN_TOKEN_KEY = 'mizan.platformAdminToken';

export const platformAdminTokenStorage = {
  getToken(): string | null {
    return localStorage.getItem(PLATFORM_ADMIN_TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(PLATFORM_ADMIN_TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(PLATFORM_ADMIN_TOKEN_KEY);
  },
};

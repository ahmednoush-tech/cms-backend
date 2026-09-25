import { useState, useCallback } from 'react';
import { platformAdminApi } from '../api/endpoints/platformAdmin';
import { platformAdminTokenStorage } from './platformAdminTokenStorage';

export function usePlatformAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!platformAdminTokenStorage.getToken());

  const login = useCallback(async (email: string, password: string) => {
    const result = await platformAdminApi.login(email, password);
    platformAdminTokenStorage.setToken(result.accessToken);
    setIsAuthenticated(true);
    return result.admin;
  }, []);

  const logout = useCallback(() => {
    platformAdminTokenStorage.clear();
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, login, logout };
}

import { apiRequest } from '../client';
import type { PlatformSettings } from '../../types/entities/platformSettings';

/** Public, unauthenticated — safe to call from any screen, logged in or not. */
export const platformSettingsPublicApi = {
  get: async (): Promise<PlatformSettings> => {
    const { data } = await apiRequest<PlatformSettings>({ method: 'GET', url: '/platform-settings' });
    return data;
  },
};

import { platformAdminApiRequest } from '../platformAdminClient';
import type { PlatformAdminLoginResult, PlatformAdminCompanySummary, PlatformAdminCompanyDetail } from '../../types/entities/platformAdmin';
import type { PlatformSettings, UpdatePlatformSettingsInput, PlatformStorageSettings, UpdatePlatformStorageSettingsInput } from '../../types/entities/platformSettings';

/** Confirmed 1:1 against backend/src/modules/platform-admin/*.controller.ts. */
export const platformAdminApi = {
  login: async (email: string, password: string): Promise<PlatformAdminLoginResult> => {
    const { data } = await platformAdminApiRequest<PlatformAdminLoginResult>({
      method: 'POST',
      url: '/platform-admin/auth/login',
      data: { email, password },
    });
    return data;
  },
  listCompanies: async (): Promise<PlatformAdminCompanySummary[]> => {
    const { data } = await platformAdminApiRequest<PlatformAdminCompanySummary[]>({ method: 'GET', url: '/platform-admin/companies' });
    return data;
  },
  getCompanyDetail: async (id: string): Promise<PlatformAdminCompanyDetail> => {
    const { data } = await platformAdminApiRequest<PlatformAdminCompanyDetail>({ method: 'GET', url: `/platform-admin/companies/${id}` });
    return data;
  },
  updateSettings: async (input: UpdatePlatformSettingsInput): Promise<PlatformSettings> => {
    const { data } = await platformAdminApiRequest<PlatformSettings>({ method: 'PATCH', url: '/platform-admin/settings', data: input });
    return data;
  },
  uploadLogo: async (file: File): Promise<PlatformSettings> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await platformAdminApiRequest<PlatformSettings>({ method: 'POST', url: '/platform-admin/settings/logo', data: formData });
    return data;
  },
  getStorageSettings: async (): Promise<PlatformStorageSettings> => {
    const { data } = await platformAdminApiRequest<PlatformStorageSettings>({ method: 'GET', url: '/platform-admin/storage-settings' });
    return data;
  },
  updateStorageSettings: async (input: UpdatePlatformStorageSettingsInput): Promise<PlatformStorageSettings> => {
    const { data } = await platformAdminApiRequest<PlatformStorageSettings>({ method: 'PATCH', url: '/platform-admin/storage-settings', data: input });
    return data;
  },
};
